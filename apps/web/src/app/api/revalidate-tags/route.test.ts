// @vitest-environment node
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidateTag, afterTasks } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  afterTasks: [] as Array<Promise<unknown>>,
}));

vi.mock('next/cache', () => ({ revalidateTag }));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    // `after` throws outside a request scope; collect the task instead.
    after: (task: Promise<unknown>) => {
      afterTasks.push(task);
    },
  };
});

const SECRET = 'test-revalidate-tags-secret';
const ORIGIN = 'https://audiofast.pl';

type Post = (request: NextRequest) => Promise<Response>;

async function loadRoute(): Promise<Post> {
  // Fresh module per test: the warm throttle is per-instance module state.
  vi.resetModules();
  const route = await import('./route');
  return route.POST as Post;
}

async function createRequest(
  body: unknown,
  auth: string | null = `Bearer ${SECRET}`,
): Promise<NextRequest> {
  const { NextRequest: NextRequestCtor } = await import('next/server');
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (auth !== null) headers.authorization = auth;
  return new NextRequestCtor(`${ORIGIN}/api/revalidate-tags/`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv('SANITY_REVALIDATE_TAGS_SECRET', SECRET);
  revalidateTag.mockReset();
  afterTasks.length = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () => new Response('<!doctype html>', { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/revalidate-tags/', () => {
  it('expires every sync tag under the sanity: prefix with the max profile', async () => {
    const POST = await loadRoute();
    const response = await POST(
      await createRequest({ tags: ['s1:a', 's1:b'] }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: 2 });
    expect(revalidateTag.mock.calls).toEqual([
      ['sanity:s1:a', 'max'],
      ['sanity:s1:b', 'max'],
    ]);
  });

  it('expires allowlisted custom tags without the sanity: prefix', async () => {
    const POST = await loadRoute();
    const response = await POST(
      await createRequest({
        customTags: ['product-pricing', 'product-pricing:atmosphere-sx-ic'],
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: 2 });
    expect(revalidateTag.mock.calls).toEqual([
      ['product-pricing', 'max'],
      ['product-pricing:atmosphere-sx-ic', 'max'],
    ]);
    // Custom tags alone warm nothing.
    expect(afterTasks).toHaveLength(0);
  });

  it('rejects custom tags outside the allowlist without expiring anything', async () => {
    const POST = await loadRoute();
    const response = await POST(
      await createRequest({ customTags: ['product-pricing', 'settings'] }),
    );

    expect(response.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('answers 401 on a wrong, missing or non-bearer secret', async () => {
    const POST = await loadRoute();
    for (const auth of ['Bearer wrong', null, SECRET, `Bearer ${SECRET}x`]) {
      const response = await POST(await createRequest({ tags: ['x'] }, auth));
      expect(response.status).toBe(401);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 401 when the server secret is not configured', async () => {
    vi.stubEnv('SANITY_REVALIDATE_TAGS_SECRET', '');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const POST = await loadRoute();
    const response = await POST(
      await createRequest({ tags: ['x'] }, 'Bearer '),
    );
    expect(response.status).toBe(401);
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['an array body', ['x']],
    ['no tag arrays', { foo: 1 }],
    ['non-string tags', { tags: ['x', 1] }],
    ['a tags string', { tags: 'x' }],
  ])('answers 400 on %s', async (_label, body) => {
    const POST = await loadRoute();
    const response = await POST(await createRequest(body));
    expect(response.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('answers 400 over the storm cap', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const POST = await loadRoute();
    const tags = Array.from({ length: 1001 }, (_, index) => `t${index}`);
    const response = await POST(await createRequest({ tags }));
    expect(response.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('warms / and /produkty/ on the request origin with a browser UA, after responding', async () => {
    const POST = await loadRoute();
    const response = await POST(await createRequest({ tags: ['s1:a'] }));
    expect(response.status).toBe(200);
    expect(afterTasks).toHaveLength(1);
    await Promise.all(afterTasks);

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([`${ORIGIN}/`, `${ORIGIN}/produkty/`]);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('user-agent')).toMatch(/Mozilla/);
    expect(init?.cache).toBe('no-store');
  });

  it('throttles warms within the window', async () => {
    const POST = await loadRoute();
    await POST(await createRequest({ tags: ['s1:a'] }));
    await POST(await createRequest({ tags: ['s1:b'] }));
    expect(afterTasks).toHaveLength(1);
    expect(revalidateTag).toHaveBeenCalledTimes(2);
  });

  it('keeps 200 when a warm fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new Error('network down'));
    const POST = await loadRoute();
    const response = await POST(await createRequest({ tags: ['s1:a'] }));
    expect(response.status).toBe(200);
    await expect(Promise.all(afterTasks)).resolves.toBeDefined();
  });

  it('warms nothing for an empty batch', async () => {
    const POST = await loadRoute();
    const response = await POST(await createRequest({ tags: [] }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: 0 });
    expect(afterTasks).toHaveLength(0);
  });

  it('answers 500 when revalidation throws, so the Function logs the failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    revalidateTag.mockImplementation(() => {
      throw new Error('cache down');
    });
    const POST = await loadRoute();
    const response = await POST(await createRequest({ tags: ['s1:a'] }));
    expect(response.status).toBe(500);
  });
});
