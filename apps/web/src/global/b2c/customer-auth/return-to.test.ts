import { describe, expect, it } from 'vitest';

import {
  buildCustomerAccountGatewayHref,
  resolveCustomerAccountReturnTo,
  sanitizeCustomerAccountReturnTo,
} from './return-to';

describe('customer auth returnTo helpers', () => {
  it('accepts protected customer-panel routes', () => {
    expect(
      sanitizeCustomerAccountReturnTo('/konto-klienta/zamowienia/AF-2026-00009'),
    ).toBe('/konto-klienta/zamowienia/AF-2026-00009/');
    expect(sanitizeCustomerAccountReturnTo('/konto-klienta/dane-konta/')).toBe(
      '/konto-klienta/dane-konta/',
    );
  });

  it('rejects non-panel and external redirects', () => {
    expect(sanitizeCustomerAccountReturnTo('/koszyk/twoje-dane/')).toBeNull();
    expect(sanitizeCustomerAccountReturnTo('https://example.com/evil')).toBeNull();
    expect(sanitizeCustomerAccountReturnTo('//example.com/evil')).toBeNull();
  });

  it('falls back to the orders route when returnTo is missing or invalid', () => {
    expect(resolveCustomerAccountReturnTo(undefined)).toBe(
      '/konto-klienta/zamowienia/',
    );
    expect(resolveCustomerAccountReturnTo('/konto-klienta/')).toBe(
      '/konto-klienta/zamowienia/',
    );
    expect(resolveCustomerAccountReturnTo('/kontakt/')).toBe(
      '/konto-klienta/zamowienia/',
    );
  });

  it('builds the gateway login URL only for safe destinations', () => {
    expect(
      buildCustomerAccountGatewayHref('/konto-klienta/zamowienia/AF-2026-00009/'),
    ).toBe(
      '/konto-klienta/?returnTo=%2Fkonto-klienta%2Fzamowienia%2FAF-2026-00009%2F',
    );
    expect(buildCustomerAccountGatewayHref('/kontakt/')).toBe(
      '/konto-klienta/',
    );
  });
});
