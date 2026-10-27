import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const fetchMock = vi.fn();

function makeRequest(body: unknown, consent = true) {
  return new Request('https://audiofast.pl/api/analytics/meta/', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(consent && {
        cookie: `cookie-consent=${encodeURIComponent(
          JSON.stringify({ conversion_api: 'granted' }),
        )}`,
      }),
    },
    body: JSON.stringify(body),
  }) as NextRequest;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ events_received: 1 }), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('META_PIXEL_ID', '1234567890');
  vi.stubEnv('META_CONVERSION_TOKEN', 'test-conversion-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('POST /api/analytics/meta', () => {
  it('reads the pixel and token from env and calls only the Meta Graph API', async () => {
    const res = await POST(makeRequest({ event_name: 'PageView' }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toMatch(
      /^https:\/\/graph\.facebook\.com\/v[\d.]+\/1234567890\/events\?/,
    );
    expect(url).not.toMatch(/sanity/i);
  });

  it('makes no request at all when the env is not configured', async () => {
    vi.stubEnv('META_CONVERSION_TOKEN', '');

    const res = await POST(makeRequest({ event_name: 'PageView' }));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('respects a missing Conversion API consent', async () => {
    const res = await POST(makeRequest({ event_name: 'PageView' }, false));

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
