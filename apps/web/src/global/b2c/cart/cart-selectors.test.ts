import { describe, expect, it } from 'vitest';

import { createEmptyCart } from './cart-domain';
import {
  getCartGrandTotalCents,
  getCartItemCount,
  getCartLineCount,
  getCartLineDiscountCents,
  getCartLineSubtotalCents,
  getCartLineTotalCents,
  getCartSubtotalCents,
  getCartTotals,
  isCartCheckoutBlocked,
} from './cart-selectors';
import { createStandardCartLine } from './standard-cart-line';

describe('cart-selectors', () => {
  it('calculates subtotal, counts, and totals', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 2,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    const state = {
      ...createEmptyCart(),
      lines: [line],
      coupon: {
        code: 'SAVE10',
        couponId: 'coupon-1',
        discountType: 'fixed_order' as const,
        discountValueCents: 10_00,
        discountPercent: null,
        productKeys: null,
        matchedProductKeys: [line.productKey],
        isValid: true,
        message: null,
        totalDiscountCents: 10_00,
        lineDiscounts: {
          [line.lineId]: 10_00,
        },
      },
    };

    expect(getCartLineSubtotalCents(line)).toBe(200_00);
    expect(getCartLineDiscountCents(state, line.lineId)).toBe(10_00);
    expect(getCartLineTotalCents(state, line)).toBe(190_00);
    expect(getCartSubtotalCents(state)).toBe(200_00);
    expect(getCartGrandTotalCents(state)).toBe(190_00);
    expect(getCartItemCount(state)).toBe(2);
    expect(getCartLineCount(state)).toBe(1);
    expect(getCartTotals(state)).toEqual({
      subtotalCents: 200_00,
      discountTotalCents: 10_00,
      grandTotalCents: 190_00,
      itemCount: 2,
      lineCount: 1,
    });
  });

  it('blocks checkout when a cart line has a blocking issue', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    line.issues = [
      {
        code: 'configuration_invalid',
        blocking: true,
        message: 'Wybrana konfiguracja nie jest już dostępna.',
      },
    ];

    expect(
      isCartCheckoutBlocked({
        ...createEmptyCart(),
        lines: [line],
      }),
    ).toBe(true);
  });
});
