import { afterEach, describe, expect, it } from 'vitest';

import {
  B2C_EMAIL_PREVIEW_BASE_URL,
  B2C_EMAIL_PRODUCTION_BASE_URL,
  buildB2cEmailUrl,
  buildB2cOrderDetailEmailUrl,
  getB2cEmailBaseUrl,
} from './email-urls';

describe('B2C email URLs', () => {
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  it('uses the real Audiofast domain only for production deployments', () => {
    process.env.VERCEL_ENV = 'production';

    expect(getB2cEmailBaseUrl()).toBe(B2C_EMAIL_PRODUCTION_BASE_URL);
    expect(buildB2cEmailUrl('/konto-klienta/')).toBe(
      'https://audiofast.pl/konto-klienta/',
    );
    expect(buildB2cOrderDetailEmailUrl('AF-2026-00007')).toBe(
      'https://audiofast.pl/konto-klienta/zamowienia/AF-2026-00007/',
    );
  });

  it('uses the B2C preview deployment domain outside production', () => {
    process.env.VERCEL_ENV = 'preview';

    expect(getB2cEmailBaseUrl()).toBe(B2C_EMAIL_PREVIEW_BASE_URL);
    expect(buildB2cEmailUrl('konto-klienta/')).toBe(
      'https://audiofast-git-b2c-kryptonum.vercel.app/konto-klienta/',
    );
    expect(buildB2cOrderDetailEmailUrl('AF-2026-00007')).toBe(
      'https://audiofast-git-b2c-kryptonum.vercel.app/konto-klienta/zamowienia/AF-2026-00007/',
    );
  });
});
