import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OPTIONS, POST } from './route';

const getByIdMock = vi.fn();

vi.mock('@sanity/client', () => ({
  createClient: vi.fn(() => ({
    users: {
      getById: getByIdMock,
    },
  })),
}));

vi.mock('@react-email/render', () => ({
  render: vi.fn(async () => '<html><body>Newsletter</body></html>'),
}));

vi.mock('@/src/emails/newsletter-template', () => ({
  default: vi.fn(() => null),
}));

vi.mock('@/src/global/mailchimp/client', () => ({
  mailchimpClient: {
    campaigns: {
      create: vi.fn(),
      setContent: vi.fn(),
    },
  },
}));

vi.mock('@/src/global/sanity/client', () => ({
  client: {
    fetch: vi.fn(async () => []),
  },
}));

vi.mock('@/src/global/sanity/query', () => ({
  queryMailchimpSettings: 'queryMailchimpSettings',
}));

const ALLOWED_ORIGIN = 'https://studio.audiofast.pl';
const BLOCKED_ORIGIN = 'https://example.com';
const SANITY_ENV = {
  NEXT_PUBLIC_SANITY_API_VERSION: '2024-01-01',
  NEXT_PUBLIC_SANITY_DATASET: 'production',
  NEXT_PUBLIC_SANITY_PROJECT_ID: 'project-id',
};

function createRequest(args: {
  body?: unknown;
  headers?: HeadersInit;
  method?: string;
}): NextRequest {
  return new NextRequest('https://audiofast.pl/api/newsletter/generate/', {
    body: args.body ? JSON.stringify(args.body) : undefined,
    headers: args.headers,
    method: args.method ?? 'POST',
  });
}

function createGeneratePayload() {
  return {
    action: 'download-html',
    content: {
      articles: [],
      reviews: [],
      products: [],
    },
    hero: {
      imageUrl: 'https://audiofast.pl/newsletter.jpg',
      text: '',
    },
    sectionOrder: ['articles', 'reviews', 'products'],
  };
}

describe('/api/newsletter/generate', () => {
  afterEach(() => {
    getByIdMock.mockReset();
    vi.unstubAllEnvs();
  });

  function stubSanityEnv() {
    for (const [key, value] of Object.entries(SANITY_ENV)) {
      vi.stubEnv(key, value);
    }
  }

  function stubAllowedOperator() {
    vi.stubEnv('B2C_ADMIN_ALLOWED_EMAILS', 'operator@audiofast.pl');
    getByIdMock.mockResolvedValue({
      email: 'operator@audiofast.pl',
      id: 'user-1',
    });
  }

  it('allows preflight requests from configured origins', async () => {
    vi.stubEnv('NEWSLETTER_GENERATE_ALLOWED_ORIGINS', ALLOWED_ORIGIN);

    const response = await OPTIONS(
      createRequest({
        headers: { Origin: ALLOWED_ORIGIN },
        method: 'OPTIONS',
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      'Authorization, Content-Type',
    );
  });

  it('blocks preflight requests from unconfigured origins', async () => {
    vi.stubEnv('NEWSLETTER_GENERATE_ALLOWED_ORIGINS', ALLOWED_ORIGIN);

    const response = await OPTIONS(
      createRequest({
        headers: { Origin: BLOCKED_ORIGIN },
        method: 'OPTIONS',
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('fails closed when the operator allowlist is not configured', async () => {
    vi.stubEnv('NEWSLETTER_GENERATE_ALLOWED_ORIGINS', ALLOWED_ORIGIN);
    stubSanityEnv();

    const response = await POST(
      createRequest({
        body: createGeneratePayload(),
        headers: {
          Authorization: 'Bearer sanity-token',
          Origin: ALLOWED_ORIGIN,
        },
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Newsletter operator allowlist is not configured',
    });
  });

  it('rejects requests without a Sanity bearer token', async () => {
    vi.stubEnv('NEWSLETTER_GENERATE_ALLOWED_ORIGINS', ALLOWED_ORIGIN);
    stubSanityEnv();
    stubAllowedOperator();

    const response = await POST(
      createRequest({
        body: createGeneratePayload(),
        headers: { Origin: ALLOWED_ORIGIN },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('rejects requests from unconfigured origins before generation', async () => {
    vi.stubEnv('NEWSLETTER_GENERATE_ALLOWED_ORIGINS', ALLOWED_ORIGIN);
    stubSanityEnv();
    stubAllowedOperator();

    const response = await POST(
      createRequest({
        body: createGeneratePayload(),
        headers: {
          Authorization: 'Bearer sanity-token',
          Origin: BLOCKED_ORIGIN,
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Origin not allowed' });
    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it('rejects Sanity users outside the operator allowlist', async () => {
    vi.stubEnv('NEWSLETTER_GENERATE_ALLOWED_ORIGINS', ALLOWED_ORIGIN);
    vi.stubEnv('B2C_ADMIN_ALLOWED_EMAILS', 'operator@audiofast.pl');
    stubSanityEnv();
    getByIdMock.mockResolvedValue({
      email: 'other@example.com',
      id: 'user-2',
    });

    const response = await POST(
      createRequest({
        body: createGeneratePayload(),
        headers: {
          Authorization: 'Bearer sanity-token',
          Origin: ALLOWED_ORIGIN,
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Operator not allowed' });
  });

  it('returns generated HTML for authorized requests', async () => {
    vi.stubEnv('NEWSLETTER_GENERATE_ALLOWED_ORIGINS', ALLOWED_ORIGIN);
    stubSanityEnv();
    stubAllowedOperator();

    const response = await POST(
      createRequest({
        body: createGeneratePayload(),
        headers: {
          Authorization: 'Bearer sanity-token',
          Origin: ALLOWED_ORIGIN,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(await response.text()).toBe('<html><body>Newsletter</body></html>');
  });
});
