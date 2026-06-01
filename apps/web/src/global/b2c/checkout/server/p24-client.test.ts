import { afterEach, describe, expect, it, vi } from 'vitest';

import { P24Client, P24ClientError } from './p24-client';
import type { P24Config } from './p24-config';

const CONFIG: P24Config = {
  mode: 'sandbox',
  merchantId: 392337,
  posId: 392337,
  apiKey: 'secret-api-key',
  crc: 'secret-crc',
  apiBaseUrl: 'https://sandbox.przelewy24.pl/api/v1',
  redirectBaseUrl: 'https://sandbox.przelewy24.pl',
  requestTimeoutMs: 10_000,
  allowedStatusIps: [],
};

function mockFetchResponse(body: unknown, init: ResponseInit = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(body, init)),
  );
}

describe('P24Client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls testAccess with Basic Auth', async () => {
    mockFetchResponse({ responseCode: 0 });

    await expect(new P24Client(CONFIG).testAccess()).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledWith(
      'https://sandbox.przelewy24.pl/api/v1/testAccess',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('392337:secret-api-key').toString(
            'base64',
          )}`,
          Accept: 'application/json',
        }),
      }),
    );
  });

  it('registers transactions', async () => {
    mockFetchResponse({
      responseCode: 0,
      data: {
        token: 'test-token',
      },
    });

    await expect(
      new P24Client(CONFIG).registerTransaction({
        merchantId: 392337,
        posId: 392337,
        sessionId: 'AF-2026-00001',
        amount: 230_00,
        currency: 'PLN',
        description: 'Zamowienie AF-2026-00001',
        email: 'jan@example.com',
        country: 'PL',
        language: 'pl',
        urlReturn:
          'https://audiofast-git-b2c-kryptonum.vercel.app/podziekowania-za-zakup/AF-2026-00001/',
        urlStatus:
          'https://audiofast-git-b2c-kryptonum.vercel.app/api/payment/status/',
        sign: 'registration-sign',
      }),
    ).resolves.toEqual({
      responseCode: 0,
      data: {
        token: 'test-token',
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://sandbox.przelewy24.pl/api/v1/transaction/register',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"sessionId":"AF-2026-00001"'),
      }),
    );
  });

  it('verifies transactions', async () => {
    mockFetchResponse({
      responseCode: 0,
      data: {
        status: 'success',
      },
    });

    await expect(
      new P24Client(CONFIG).verifyTransaction({
        merchantId: 392337,
        posId: 392337,
        sessionId: 'AF-2026-00001',
        amount: 230_00,
        currency: 'PLN',
        orderId: 123456789,
        sign: 'verification-sign',
      }),
    ).resolves.toEqual({
      responseCode: 0,
      data: {
        status: 'success',
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://sandbox.przelewy24.pl/api/v1/transaction/verify',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"orderId":123456789'),
      }),
    );
  });

  it('maps P24 responseCode errors without exposing secrets', async () => {
    mockFetchResponse({
      responseCode: 101,
      error: 'invalid input',
    });

    await expect(new P24Client(CONFIG).testAccess()).rejects.toMatchObject({
      code: 'p24_error',
      responseCode: 101,
      message: 'Przelewy24 testAccess request returned responseCode 101.',
    });

    await expect(new P24Client(CONFIG).testAccess()).rejects.not.toThrow(
      /secret-api-key|secret-crc/,
    );
  });

  it('maps HTTP errors', async () => {
    mockFetchResponse(
      {
        responseCode: 0,
      },
      {
        status: 401,
      },
    );

    await expect(new P24Client(CONFIG).testAccess()).rejects.toMatchObject({
      code: 'http_error',
      status: 401,
      responseBody: {
        responseCode: 0,
      },
    });
  });

  it('maps invalid JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('not-json', {
            status: 200,
          }),
      ),
    );

    await expect(new P24Client(CONFIG).testAccess()).rejects.toBeInstanceOf(
      P24ClientError,
    );
    await expect(new P24Client(CONFIG).testAccess()).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });
});
