import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptyCart } from './cart-domain';
import {
  clearCartStorage,
  loadCartFromStorage,
  saveCartToStorage,
} from './cart-persistence';
import { createStandardCartLine } from './standard-cart-line';

describe('cart-persistence', () => {
  const localStorageMock = {
    getItem: vi.fn<(key: string) => string | null>(),
    setItem: vi.fn<(key: string, value: string) => void>(),
    removeItem: vi.fn<(key: string) => void>(),
  };

  beforeEach(() => {
    let storageValue: string | null = null;

    localStorageMock.getItem.mockImplementation(() => storageValue);
    localStorageMock.setItem.mockImplementation((_, value) => {
      storageValue = value;
    });
    localStorageMock.removeItem.mockImplementation(() => {
      storageValue = null;
    });

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads an empty cart when storage is empty', () => {
    clearCartStorage();

    expect(loadCartFromStorage()).toEqual(createEmptyCart());
  });

  it('saves and loads cart state from localStorage', () => {
    const state = createEmptyCart();
    state.lines = [
      createStandardCartLine({
        lineId: 'line-1',
        productId: 'product-1',
        productKey: '/produkty/test',
        productName: 'Test product',
        brandName: 'Test brand',
        quantity: 1,
        unitPriceCents: 100_00,
        isReturnable: true,
        configurationSelection: {
          variantId: 'variant-1',
          selectedOptions: {
            model: 'default',
          },
        },
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
      }),
    ];

    saveCartToStorage(state);

    expect(loadCartFromStorage()).toEqual(state);
    expect(loadCartFromStorage().lines[0]).toMatchObject({
      configurationSelection: {
        variantId: 'variant-1',
        selectedOptions: {
          model: 'default',
        },
      },
    });
  });

  it('drops invalid persisted coupons when loading from localStorage', () => {
    const state = {
      ...createEmptyCart(),
      coupon: {
        code: 'SAVE20',
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
      },
    };

    saveCartToStorage(state);

    expect(loadCartFromStorage()).toEqual(createEmptyCart());
  });

  it('does not persist invalid coupons back into localStorage', () => {
    const state = {
      ...createEmptyCart(),
      coupon: {
        code: 'SAVE20',
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
      },
    };

    saveCartToStorage(state);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(createEmptyCart()),
    );
  });
});
