import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildCheckoutCartFingerprint,
  CHECKOUT_CART_CLEANUP_STORAGE_KEY,
  loadPendingCheckoutCartCleanup,
  persistPendingCheckoutCartCleanup,
  removePendingCheckoutCartCleanup,
} from './cart-checkout-cleanup';
import { createEmptyCart } from './cart-domain';
import { createStandardCartLine } from './standard-cart-line';

describe('cart-checkout-cleanup', () => {
  const localStorageMock = {
    getItem: vi.fn<(key: string) => string | null>(),
    setItem: vi.fn<(key: string, value: string) => void>(),
    removeItem: vi.fn<(key: string) => void>(),
  };

  beforeEach(() => {
    const storage = new Map<string, string>();

    localStorageMock.getItem.mockImplementation(
      (key) => storage.get(key) ?? null,
    );
    localStorageMock.setItem.mockImplementation((key, value) => {
      storage.set(key, value);
    });
    localStorageMock.removeItem.mockImplementation((key) => {
      storage.delete(key);
    });

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('persists and reloads a pending cart cleanup marker', () => {
    persistPendingCheckoutCartCleanup({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      startedAt: '2026-04-22T10:00:00.000Z',
      cartFingerprint: '{"version":1,"lines":[],"coupon":null}',
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      CHECKOUT_CART_CLEANUP_STORAGE_KEY,
      JSON.stringify({
        orderId: 'order-1',
        orderNumber: 'AF-2026-00001',
        startedAt: '2026-04-22T10:00:00.000Z',
        cartFingerprint: '{"version":1,"lines":[],"coupon":null}',
      }),
    );
    expect(loadPendingCheckoutCartCleanup()).toEqual({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      startedAt: '2026-04-22T10:00:00.000Z',
      cartFingerprint: '{"version":1,"lines":[],"coupon":null}',
    });
  });

  it('removes the pending cart cleanup marker', () => {
    persistPendingCheckoutCartCleanup({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      startedAt: '2026-04-22T10:00:00.000Z',
      cartFingerprint: '{"version":1,"lines":[],"coupon":null}',
    });

    removePendingCheckoutCartCleanup();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      CHECKOUT_CART_CLEANUP_STORAGE_KEY,
    );
    expect(loadPendingCheckoutCartCleanup()).toBeNull();
  });

  it('builds the same fingerprint shape that cart persistence stores', () => {
    const cart = {
      ...createEmptyCart(),
      lines: [
        createStandardCartLine({
          lineId: 'line-1',
          productId: 'product-1',
          productKey: '/produkty/test/',
          productName: 'Test product',
          brandName: 'Test brand',
          quantity: 1,
          unitPriceCents: 150_00,
          isReturnable: true,
          product: {
            id: 'product-1',
            name: 'Test product',
            brandName: 'Test brand',
            kind: 'standard',
            image: { id: 'image-1' },
            basePrice: 150_00,
            configurationOptions: [],
            totalPrice: 150_00,
          },
        }),
      ],
    };

    expect(buildCheckoutCartFingerprint(cart)).toContain('"lineId":"line-1"');
    expect(buildCheckoutCartFingerprint(cart)).toContain('"coupon":null');
  });
});
