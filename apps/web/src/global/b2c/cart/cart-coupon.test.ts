import { describe, expect, it } from 'vitest';

import {
  applyCouponToCart,
  applyInvalidCouponToCart,
  clearCoupon,
  syncCouponWithCart,
} from './cart-coupon';
import { createEmptyCart } from './cart-domain';
import { createCpoCartLine } from './cpo-cart-line';
import { createStandardCartLine } from './standard-cart-line';
import type { CartCouponDefinition } from './types';

const orderCoupon: CartCouponDefinition = {
  id: 'coupon-1',
  code: 'SAVE20',
  isActive: true,
  discountType: 'fixed_order',
  discountValueCents: 20_00,
  discountPercent: null,
  productKeys: null,
  usageLimit: null,
  usageCount: 0,
  startsAt: null,
  expiresAt: null,
};

const productCoupon: CartCouponDefinition = {
  id: 'coupon-2',
  code: 'PRODUCT10',
  isActive: true,
  discountType: 'fixed_product',
  discountValueCents: 10_00,
  discountPercent: null,
  productKeys: ['/produkty/test'],
  usageLimit: null,
  usageCount: 0,
  startsAt: null,
  expiresAt: null,
};

describe('cart-coupon', () => {
  it('applies a fixed order discount once to the full cart', () => {
    const standardLine = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 2,
      unitPriceCents: 50_00,
      isReturnable: true,
      configurationSummary: [],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 50_00,
        configurationOptions: [],
        totalPrice: 50_00,
      },
    });

    const state = applyCouponToCart(
      {
        ...createEmptyCart(),
        lines: [standardLine],
      },
      orderCoupon,
    );

    expect(state.coupon?.isValid).toBe(true);
    expect(state.coupon?.totalDiscountCents).toBe(20_00);
    expect(state.coupon?.lineDiscounts['line-1']).toBe(20_00);
  });

  it('applies a product-specific fixed discount per eligible unit quantity', () => {
    const standardLine = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 2,
      unitPriceCents: 50_00,
      isReturnable: true,
      configurationSummary: [],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 50_00,
        configurationOptions: [],
        totalPrice: 50_00,
      },
    });

    const cpoLine = createCpoCartLine({
      lineId: 'line-2',
      productId: 'cpo-1',
      productKey: 'CPO-1',
      productName: 'Test CPO',
      brandName: 'Test brand',
      unitPriceCents: 100_00,
      isReturnable: false,
      availabilityStatus: 'available',
      product: {
        id: 'cpo-1',
        name: 'Test CPO',
        brandName: 'Test brand',
        kind: 'cpo',
        image: { id: 'image-2' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    const state = applyCouponToCart(
      {
        ...createEmptyCart(),
        lines: [standardLine, cpoLine],
      },
      productCoupon,
    );

    expect(state.coupon?.isValid).toBe(true);
    expect(state.coupon?.totalDiscountCents).toBe(20_00);
    expect(state.coupon?.lineDiscounts['line-1']).toBe(20_00);
    expect(state.coupon?.lineDiscounts['line-2']).toBeUndefined();
  });

  it('preserves an invalid coupon when it no longer matches cart contents', () => {
    const standardLine = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 50_00,
      isReturnable: true,
      configurationSummary: [],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 50_00,
        configurationOptions: [],
        totalPrice: 50_00,
      },
    });

    const appliedState = applyCouponToCart(
      {
        ...createEmptyCart(),
        lines: [standardLine],
      },
      productCoupon,
    );

    const syncedState = syncCouponWithCart({
      ...appliedState,
      lines: [],
    });

    expect(syncedState.coupon?.isValid).toBe(false);
    expect(syncedState.coupon?.code).toBe('PRODUCT10');
  });

  it('stores a trimmed invalid coupon state for later runtime handling', () => {
    const state = applyInvalidCouponToCart(
      createEmptyCart(),
      '  save20  ',
      'Kod rabatowy nie istnieje.',
    );

    expect(state.coupon).toEqual({
      code: 'save20',
      couponId: null,
      discountType: null,
      discountValueCents: null,
      discountPercent: null,
      productKeys: null,
      matchedProductKeys: [],
      isValid: false,
      message: 'Kod rabatowy nie istnieje.',
      totalDiscountCents: 0,
      lineDiscounts: {},
    });
  });

  it('clears coupon state instead of persisting an empty invalid code', () => {
    const state = applyInvalidCouponToCart(
      {
        ...createEmptyCart(),
        coupon: {
          code: 'SAVE20',
          couponId: 'coupon-1',
          discountType: 'fixed_order',
          discountValueCents: 20_00,
          discountPercent: null,
          productKeys: null,
          matchedProductKeys: [],
          isValid: true,
          message: null,
          totalDiscountCents: 20_00,
          lineDiscounts: {},
        },
      },
      '   ',
      'Kod rabatowy nie istnieje.',
    );

    expect(state.coupon).toBeNull();
  });

  it('marks inactive coupons as invalid', () => {
    const state = applyCouponToCart(createEmptyCart(), {
      ...orderCoupon,
      isActive: false,
    });

    expect(state.coupon?.isValid).toBe(false);
    expect(state.coupon?.message).toBe('Kod rabatowy jest nieaktywny.');
    expect(state.coupon?.code).toBe('SAVE20');
  });

  it('marks expired or not-yet-active coupons as invalid', () => {
    const now = new Date('2026-04-14T10:00:00.000Z');

    const expiredState = applyCouponToCart(
      createEmptyCart(),
      {
        ...orderCoupon,
        expiresAt: '2026-04-14T09:59:59.000Z',
      },
      now,
    );
    const futureState = applyCouponToCart(
      createEmptyCart(),
      {
        ...orderCoupon,
        startsAt: '2026-04-14T10:00:01.000Z',
      },
      now,
    );

    expect(expiredState.coupon?.isValid).toBe(false);
    expect(expiredState.coupon?.message).toBe(
      'Kod rabatowy jest poza aktywnym oknem czasowym.',
    );
    expect(futureState.coupon?.isValid).toBe(false);
    expect(futureState.coupon?.message).toBe(
      'Kod rabatowy jest poza aktywnym oknem czasowym.',
    );
  });

  it('marks usage-limited coupons as invalid when the limit is reached', () => {
    const state = applyCouponToCart(createEmptyCart(), {
      ...orderCoupon,
      usageLimit: 10,
      usageCount: 10,
    });

    expect(state.coupon?.isValid).toBe(false);
    expect(state.coupon?.message).toBe('Kod rabatowy przekroczył limit użyć.');
  });

  it('clears coupon state explicitly', () => {
    const state = clearCoupon({
      ...createEmptyCart(),
      coupon: {
        code: 'SAVE20',
        couponId: 'coupon-1',
        discountType: 'fixed_order',
        discountValueCents: 20_00,
        discountPercent: null,
        productKeys: null,
        matchedProductKeys: [],
        isValid: true,
        message: null,
        totalDiscountCents: 20_00,
        lineDiscounts: {},
      },
    });

    expect(state.coupon).toBeNull();
  });
});
