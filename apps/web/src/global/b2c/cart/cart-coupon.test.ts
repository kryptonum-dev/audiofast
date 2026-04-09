import { describe, expect, it } from 'vitest';

import { createEmptyCart } from './cart-domain';
import { applyCouponToCart, clearCoupon, syncCouponWithCart } from './cart-coupon';
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
