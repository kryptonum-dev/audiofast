import { createEmptyCart } from './cart-domain';
import { stripManagedCartLineIssues } from './cart-revalidation';
import { CART_STORAGE_KEY, CART_STORAGE_VERSION } from './constants';
import type { CartState, PersistedCartState } from './types';

function isPersistedCartState(value: unknown): value is PersistedCartState {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<PersistedCartState>;

  return (
    candidate.version === CART_STORAGE_VERSION &&
    Array.isArray(candidate.lines) &&
    ('coupon' in candidate || candidate.coupon === null)
  );
}

function sanitizeCartForPersistence(state: CartState): CartState {
  const sanitizedLines = state.lines.map(stripManagedCartLineIssues);

  if (!state.coupon || state.coupon.isValid) {
    return {
      ...state,
      lines: sanitizedLines,
    };
  }

  return {
    ...state,
    lines: sanitizedLines,
    coupon: null,
  };
}

export function loadCartFromStorage(): CartState {
  if (typeof window === 'undefined') {
    return createEmptyCart();
  }

  const rawValue = window.localStorage.getItem(CART_STORAGE_KEY);

  if (!rawValue) {
    return createEmptyCart();
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return isPersistedCartState(parsed)
      ? sanitizeCartForPersistence(parsed)
      : createEmptyCart();
  } catch {
    return createEmptyCart();
  }
}

export function saveCartToStorage(state: CartState): void {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify(sanitizeCartForPersistence(state)),
  );
}

export function clearCartStorage(): void {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(CART_STORAGE_KEY);
}
