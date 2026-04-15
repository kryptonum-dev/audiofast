import { describe, expect, it } from 'vitest';

import { createEmptyCart } from './cart-domain';
import {
  getCheckoutCartTotals,
  getCartGrandTotalCents,
  getCartItemCount,
  getCartVisibleLineDiscountCents,
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
    expect(getCheckoutCartTotals(state)).toEqual({
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

  it('hides line-level discount display for whole-order coupons while keeping raw line discounts intact', () => {
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

    const orderCouponState = {
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
    const productCouponState = {
      ...orderCouponState,
      coupon: {
        ...orderCouponState.coupon,
        discountType: 'fixed_product' as const,
        productKeys: [line.productKey],
      },
    };

    expect(getCartLineDiscountCents(orderCouponState, line.lineId)).toBe(10_00);
    expect(getCartVisibleLineDiscountCents(orderCouponState, line.lineId)).toBe(
      0,
    );
    expect(
      getCartVisibleLineDiscountCents(productCouponState, line.lineId),
    ).toBe(10_00);
  });

  it('excludes blocked lines from checkout totals while keeping cart totals unchanged', () => {
    const validLine = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Valid product',
      brandName: 'Test brand',
      quantity: 2,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [],
      product: {
        id: 'product-1',
        name: 'Valid product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });
    const blockedLine = createStandardCartLine({
      lineId: 'line-2',
      productId: 'product-2',
      productKey: '/produkty/blocked',
      productName: 'Blocked product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 50_00,
      isReturnable: true,
      configurationSummary: [],
      product: {
        id: 'product-2',
        name: 'Blocked product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-2' },
        basePrice: 50_00,
        configurationOptions: [],
        totalPrice: 50_00,
      },
    });

    blockedLine.issues = [
      {
        code: 'not_buyable',
        blocking: true,
        message: 'Produkt nie jest już dostępny do zakupu.',
      },
    ];

    const state = {
      ...createEmptyCart(),
      lines: [validLine, blockedLine],
    };

    expect(getCartTotals(state)).toEqual({
      subtotalCents: 250_00,
      discountTotalCents: 0,
      grandTotalCents: 250_00,
      itemCount: 3,
      lineCount: 2,
    });
    expect(getCheckoutCartTotals(state)).toEqual({
      subtotalCents: 200_00,
      discountTotalCents: 0,
      grandTotalCents: 200_00,
      itemCount: 2,
      lineCount: 1,
    });
  });
});
