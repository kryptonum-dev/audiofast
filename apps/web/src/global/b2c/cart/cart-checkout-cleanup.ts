import { serializeCartForStorage } from './cart-persistence';
import type { CartState } from './types';

export const CHECKOUT_CART_CLEANUP_STORAGE_KEY =
  'audiofast:b2c-checkout-cart-cleanup';
export const CHECKOUT_CART_CLEANUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingCheckoutCartCleanup = {
  orderId: string;
  orderNumber: string;
  startedAt: string;
  cartFingerprint: string;
};

function isPendingCheckoutCartCleanup(
  value: unknown,
): value is PendingCheckoutCartCleanup {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PendingCheckoutCartCleanup>;

  return (
    typeof candidate.orderId === 'string' &&
    typeof candidate.orderNumber === 'string' &&
    typeof candidate.startedAt === 'string' &&
    typeof candidate.cartFingerprint === 'string'
  );
}

export function buildCheckoutCartFingerprint(cart: CartState): string {
  return serializeCartForStorage(cart);
}

export function persistPendingCheckoutCartCleanup(
  value: PendingCheckoutCartCleanup,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    CHECKOUT_CART_CLEANUP_STORAGE_KEY,
    JSON.stringify(value),
  );
}

export function loadPendingCheckoutCartCleanup(): PendingCheckoutCartCleanup | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(
    CHECKOUT_CART_CLEANUP_STORAGE_KEY,
  );

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return isPendingCheckoutCartCleanup(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function removePendingCheckoutCartCleanup(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(CHECKOUT_CART_CLEANUP_STORAGE_KEY);
}
