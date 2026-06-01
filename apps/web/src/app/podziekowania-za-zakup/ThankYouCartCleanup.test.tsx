import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHECKOUT_CART_CLEANUP_STORAGE_KEY } from '@/src/global/b2c/cart/cart-checkout-cleanup';
import { createEmptyCart } from '@/src/global/b2c/cart/cart-domain';
import { useCart } from '@/src/global/b2c/cart/use-cart';

import ThankYouCartCleanup from './ThankYouCartCleanup';

vi.mock('@/src/global/b2c/cart/use-cart', () => ({
  useCart: vi.fn(),
}));

describe('ThankYouCartCleanup', () => {
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

  it.each(['awaiting_payment', 'paid'] as const)(
    'clears the cart and removes the marker when the %s thank-you order matches the stored checkout marker',
    (stateId) => {
      const clearCart = vi.fn();

      vi.mocked(useCart).mockReturnValue({
        cart: createEmptyCart(),
        clearCart,
        isHydrated: true,
      } as never);
      localStorageMock.setItem(
        CHECKOUT_CART_CLEANUP_STORAGE_KEY,
        JSON.stringify({
          orderId: 'order-1',
          orderNumber: 'AF-2026-00001',
          startedAt: new Date().toISOString(),
          cartFingerprint: '{"version":1,"lines":[],"coupon":null}',
        }),
      );

      render(
        <ThankYouCartCleanup stateId={stateId} orderNumber="AF-2026-00001" />,
      );

      expect(clearCart).toHaveBeenCalledTimes(1);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        CHECKOUT_CART_CLEANUP_STORAGE_KEY,
      );
    },
  );

  it.each(['expired', 'invalid_access'] as const)(
    'does not clear the cart for %s thank-you states',
    (stateId) => {
      const clearCart = vi.fn();

      vi.mocked(useCart).mockReturnValue({
        cart: createEmptyCart(),
        clearCart,
        isHydrated: true,
      } as never);
      localStorageMock.setItem(
        CHECKOUT_CART_CLEANUP_STORAGE_KEY,
        JSON.stringify({
          orderId: 'order-1',
          orderNumber: 'AF-2026-00001',
          startedAt: new Date().toISOString(),
          cartFingerprint: '{"version":1,"lines":[],"coupon":null}',
        }),
      );

      render(
        <ThankYouCartCleanup stateId={stateId} orderNumber="AF-2026-00001" />,
      );

      expect(clearCart).not.toHaveBeenCalled();
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(
        CHECKOUT_CART_CLEANUP_STORAGE_KEY,
      );
    },
  );

  it('does not clear the cart when the thank-you order does not match the stored marker', () => {
    const clearCart = vi.fn();

    vi.mocked(useCart).mockReturnValue({
      cart: createEmptyCart(),
      clearCart,
      isHydrated: true,
    } as never);
    localStorageMock.setItem(
      CHECKOUT_CART_CLEANUP_STORAGE_KEY,
      JSON.stringify({
        orderId: 'order-1',
        orderNumber: 'AF-2026-00001',
        startedAt: new Date().toISOString(),
        cartFingerprint: '{"version":1,"lines":[],"coupon":null}',
      }),
    );

    render(<ThankYouCartCleanup stateId="paid" orderNumber="AF-2026-00002" />);

    expect(clearCart).not.toHaveBeenCalled();
  });

  it('removes the marker without clearing when the cart fingerprint no longer matches', () => {
    const clearCart = vi.fn();

    vi.mocked(useCart).mockReturnValue({
      cart: {
        ...createEmptyCart(),
        coupon: {
          code: 'SAVE20',
          couponId: null,
          discountType: null,
          discountValueCents: null,
          discountPercent: null,
          productKeys: null,
          matchedProductKeys: [],
          isValid: true,
          message: null,
          totalDiscountCents: 0,
          lineDiscounts: {},
        },
      },
      clearCart,
      isHydrated: true,
    } as never);
    localStorageMock.setItem(
      CHECKOUT_CART_CLEANUP_STORAGE_KEY,
      JSON.stringify({
        orderId: 'order-1',
        orderNumber: 'AF-2026-00001',
        startedAt: new Date().toISOString(),
        cartFingerprint: '{"version":1,"lines":[],"coupon":null}',
      }),
    );

    render(<ThankYouCartCleanup stateId="paid" orderNumber="AF-2026-00001" />);

    expect(clearCart).not.toHaveBeenCalled();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      CHECKOUT_CART_CLEANUP_STORAGE_KEY,
    );
  });
});
