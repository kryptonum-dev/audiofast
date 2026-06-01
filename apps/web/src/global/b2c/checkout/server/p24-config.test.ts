import { describe, expect, it } from 'vitest';

import { getP24Mode, loadP24Config, P24ConfigError } from './p24-config';

const SANDBOX_ENV = {
  P24_MODE: 'sandbox',
  P24_MERCHANT_ID: '392337',
  P24_POS_ID: '392337',
  P24_API_KEY: 'sandbox-api-key',
  P24_CRC: 'sandbox-crc',
};

describe('p24-config', () => {
  it('defaults to mock mode when P24_MODE is not set', () => {
    expect(getP24Mode({})).toBe('mock');
  });

  it('reads explicit mock mode outside production', () => {
    expect(getP24Mode({ P24_MODE: 'mock' })).toBe('mock');
  });

  it('forces mock mode when P24_FORCE_MOCK is enabled', () => {
    expect(
      getP24Mode({
        P24_MODE: 'sandbox',
        P24_FORCE_MOCK: '1',
      }),
    ).toBe('mock');
  });

  it('rejects invalid P24_MODE values outside production', () => {
    expect(() => getP24Mode({ P24_MODE: 'prod' })).toThrow(P24ConfigError);
  });

  it('allows only production mode in production runtime', () => {
    expect(
      getP24Mode({
        VERCEL_ENV: 'production',
        P24_MODE: 'production',
      }),
    ).toBe('production');
  });

  it('rejects missing P24_MODE in production runtime', () => {
    expect(() => getP24Mode({ VERCEL_ENV: 'production' })).toThrow(
      P24ConfigError,
    );
  });

  it('rejects mock mode in production runtime', () => {
    expect(() =>
      getP24Mode({
        VERCEL_ENV: 'production',
        P24_MODE: 'mock',
      }),
    ).toThrow(P24ConfigError);
  });

  it('rejects sandbox mode in production runtime', () => {
    expect(() =>
      getP24Mode({
        VERCEL_ENV: 'production',
        P24_MODE: 'sandbox',
      }),
    ).toThrow(P24ConfigError);
  });

  it('rejects forced mock mode in production runtime', () => {
    expect(() =>
      getP24Mode({
        VERCEL_ENV: 'production',
        P24_MODE: 'production',
        P24_FORCE_MOCK: '1',
      }),
    ).toThrow(P24ConfigError);
  });

  it('loads sandbox config with default P24 URLs', () => {
    expect(loadP24Config(SANDBOX_ENV)).toEqual({
      mode: 'sandbox',
      merchantId: 392337,
      posId: 392337,
      apiKey: 'sandbox-api-key',
      crc: 'sandbox-crc',
      apiBaseUrl: 'https://sandbox.przelewy24.pl/api/v1',
      redirectBaseUrl: 'https://sandbox.przelewy24.pl',
      requestTimeoutMs: 10_000,
      allowedStatusIps: [],
    });
  });

  it('loads production config with default P24 URLs', () => {
    expect(
      loadP24Config({
        ...SANDBOX_ENV,
        P24_MODE: 'production',
        P24_API_KEY: 'production-api-key',
        P24_CRC: 'production-crc',
      }),
    ).toEqual(
      expect.objectContaining({
        mode: 'production',
        apiKey: 'production-api-key',
        crc: 'production-crc',
        apiBaseUrl: 'https://secure.przelewy24.pl/api/v1',
        redirectBaseUrl: 'https://secure.przelewy24.pl',
      }),
    );
  });

  it('supports HTTPS URL overrides and allowed status IPs', () => {
    expect(
      loadP24Config({
        ...SANDBOX_ENV,
        P24_API_BASE_URL: 'https://example.com/api/v1/',
        P24_PANEL_BASE_URL: 'https://pay.example.com/',
        P24_REQUEST_TIMEOUT_MS: '5000',
        P24_STATUS_ALLOWED_IPS: '5.252.202.255, 20.215.81.124',
      }),
    ).toEqual(
      expect.objectContaining({
        apiBaseUrl: 'https://example.com/api/v1',
        redirectBaseUrl: 'https://pay.example.com',
        requestTimeoutMs: 5000,
        allowedStatusIps: ['5.252.202.255', '20.215.81.124'],
      }),
    );
  });

  it('rejects missing live credentials', () => {
    expect(() =>
      loadP24Config({
        P24_MODE: 'sandbox',
        P24_POS_ID: '392337',
        P24_API_KEY: 'sandbox-api-key',
        P24_CRC: 'sandbox-crc',
      }),
    ).toThrow(P24ConfigError);
  });

  it('rejects non-HTTPS P24 URL overrides', () => {
    expect(() =>
      loadP24Config({
        ...SANDBOX_ENV,
        P24_API_BASE_URL: 'http://example.com/api/v1',
      }),
    ).toThrow(P24ConfigError);
  });
});
