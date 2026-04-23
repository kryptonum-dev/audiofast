'use client';

import { useEffect, useRef } from 'react';

import {
  buildCheckoutCartFingerprint,
  CHECKOUT_CART_CLEANUP_MAX_AGE_MS,
  loadPendingCheckoutCartCleanup,
  removePendingCheckoutCartCleanup,
} from '@/src/global/b2c/cart/cart-checkout-cleanup';
import { useCart } from '@/src/global/b2c/cart/use-cart';

type ThankYouCartCleanupProps = {
  stateId: 'awaiting_payment' | 'paid' | 'expired' | 'invalid_access';
  orderNumber: string | null;
};

export default function ThankYouCartCleanup({
  stateId,
  orderNumber,
}: ThankYouCartCleanupProps) {
  const { cart, clearCart, isHydrated } = useCart();
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (
      hasProcessedRef.current ||
      !isHydrated ||
      stateId !== 'paid' ||
      orderNumber === null
    ) {
      return;
    }

    try {
      const cleanup = loadPendingCheckoutCartCleanup();

      if (!cleanup) {
        hasProcessedRef.current = true;
        return;
      }

      const startedAt = Date.parse(cleanup.startedAt);

      if (
        Number.isNaN(startedAt) ||
        Date.now() - startedAt > CHECKOUT_CART_CLEANUP_MAX_AGE_MS
      ) {
        removePendingCheckoutCartCleanup();
        hasProcessedRef.current = true;
        return;
      }

      if (cleanup.orderNumber !== orderNumber) {
        hasProcessedRef.current = true;
        return;
      }

      if (buildCheckoutCartFingerprint(cart) !== cleanup.cartFingerprint) {
        removePendingCheckoutCartCleanup();
        hasProcessedRef.current = true;
        return;
      }

      clearCart();
      removePendingCheckoutCartCleanup();
      hasProcessedRef.current = true;
    } catch (error) {
      removePendingCheckoutCartCleanup();
      hasProcessedRef.current = true;
      console.error('Failed to complete checkout cart cleanup.', error);
    }
  }, [cart, clearCart, isHydrated, orderNumber, stateId]);

  return null;
}
