import { describe, expect, it } from 'vitest';

import { createEmptyCart } from '@/src/global/b2c/cart/cart-domain';
import {
  type CartAction,
  cartReducer,
} from '@/src/global/b2c/cart/cart-reducer';
import { applyCartRevalidation } from '@/src/global/b2c/cart/cart-revalidation';
import { createCpoCartLine } from '@/src/global/b2c/cart/cpo-cart-line';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';

function applyActions(actions: CartAction[]) {
  return actions.reduce(
    (state, action) => cartReducer(state, action),
    createEmptyCart(),
  );
}

describe('cartReducer', () => {
  it('hydrates the cart state', () => {
    const hydratedState = {
      version: 1,
      lines: [],
      coupon: null,
    };

    expect(
      cartReducer(undefined, {
        type: 'hydrate',
        payload: hydratedState,
      }),
    ).toEqual(hydratedState);
  });

  it('adds and merges standard lines through the domain layer', () => {
    const firstLine = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [{ label: 'Model', value: 'A' }],
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

    const secondLine = createStandardCartLine({
      lineId: 'line-2',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 2,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [{ label: 'Model', value: 'A' }],
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

    const state = applyActions([
      {
        type: 'add-line',
        payload: firstLine,
      },
      {
        type: 'add-line',
        payload: secondLine,
      },
    ]);

    expect(state.lines).toHaveLength(1);
    expect(state.lines[0]?.quantity).toBe(3);
  });

  it('keeps cpo lines specimen-based in the reducer', () => {
    const cpoLine = createCpoCartLine({
      lineId: 'line-1',
      productId: 'cpo-1',
      productKey: 'CPO-1',
      productName: 'Test CPO',
      brandName: 'Test brand',
      unitPriceCents: 200_00,
      isReturnable: false,
      availabilityStatus: 'available',
      product: {
        id: 'cpo-1',
        name: 'Test CPO',
        brandName: 'Test brand',
        kind: 'cpo',
        image: { id: 'image-1' },
        basePrice: 200_00,
        configurationOptions: [],
        totalPrice: 200_00,
      },
    });

    const state = applyActions([
      {
        type: 'add-line',
        payload: cpoLine,
      },
      {
        type: 'set-standard-line-quantity',
        payload: {
          lineId: 'line-1',
          quantity: 5,
        },
      },
    ]);

    expect(state.lines[0]?.lineType).toBe('cpo');
    expect(state.lines[0]?.quantity).toBe(1);
  });

  it('applies, invalidates, and clears coupons through reducer actions', () => {
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

    const appliedState = applyActions([
      {
        type: 'add-line',
        payload: line,
      },
      {
        type: 'apply-coupon',
        payload: {
          coupon: {
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
          },
        },
      },
    ]);

    expect(appliedState.coupon?.isValid).toBe(true);
    expect(appliedState.coupon?.totalDiscountCents).toBe(20_00);

    const invalidState = cartReducer(appliedState, {
      type: 'apply-invalid-coupon',
      payload: {
        code: 'MISSING',
        message: 'Kod rabatowy nie istnieje.',
      },
    });

    expect(invalidState.coupon?.isValid).toBe(false);
    expect(invalidState.coupon?.code).toBe('MISSING');

    const clearedState = cartReducer(invalidState, {
      type: 'clear-coupon',
    });

    expect(clearedState.coupon).toBeNull();
  });

  it('applies cart line revalidation results through the reducer', () => {
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

    const state = applyActions([
      {
        type: 'add-line',
        payload: line,
      },
      {
        type: 'apply-line-revalidation',
        payload: {
          results: [
            {
              lineId: 'line-1',
              lineType: 'standard',
              isBuyable: true,
              isConfigurationValid: false,
              unitPriceCents: 120_00,
            },
          ],
        },
      },
    ]);

    expect(state).toEqual(
      applyCartRevalidation(
        {
          ...createEmptyCart(),
          lines: [line],
          coupon: null,
        },
        [
          {
            lineId: 'line-1',
            lineType: 'standard',
            isBuyable: true,
            isConfigurationValid: false,
            unitPriceCents: 120_00,
          },
        ],
      ),
    );
  });
});
