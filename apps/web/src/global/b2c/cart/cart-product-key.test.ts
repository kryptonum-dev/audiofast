import { describe, expect, it } from 'vitest';

import {
  buildCartProductRouteSlug,
  extractCartProductSlug,
} from '@/src/global/b2c/cart/cart-product-key';

describe('cart-product-key', () => {
  it('extracts the leaf product slug from slash-delimited keys', () => {
    expect(extractCartProductSlug('artesania-audio/prestige')).toBe('prestige');
    expect(extractCartProductSlug('/produkty/prestige/')).toBe('prestige');
    expect(extractCartProductSlug('artesania-audio/Absolute-Rack')).toBe(
      'absolute-rack',
    );
  });

  it('returns null for malformed product keys', () => {
    expect(extractCartProductSlug('BROKEN-KEY')).toBeNull();
    expect(extractCartProductSlug('')).toBeNull();
  });

  it('builds a standard product route slug from a pricing key slug', () => {
    expect(buildCartProductRouteSlug('prestige', 'standard')).toBe(
      '/produkty/prestige/',
    );
    expect(
      buildCartProductRouteSlug('artesania-audio/prestige', 'standard'),
    ).toBe('/produkty/prestige/');
    expect(
      buildCartProductRouteSlug('artesania-audio/Absolute-Rack', 'standard'),
    ).toBe('/produkty/absolute-rack/');
  });

  it('builds a cpo product route slug from a cart product slug', () => {
    expect(
      buildCartProductRouteSlug('/certyfikowany-sprzet-uzywany/test-cpo/', 'cpo'),
    ).toBe('/certyfikowany-sprzet-uzywany/test-cpo/');
  });
});
