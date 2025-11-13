import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

import type { ComparisonCookie } from './types';

const COOKIE_NAME = 'audiofast_comparison';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const MAX_PRODUCTS = 3;

/**
 * Custom event name for comparison cookie changes
 */
const COMPARISON_CHANGE_EVENT = 'audiofast:comparison-changed';

/**
 * Dispatch a custom event when comparison cookie changes
 * This allows components to react to changes without polling
 * @param productData - Optional product data to include in the event for optimistic updates
 */
function dispatchComparisonChangeEvent(productData?: unknown): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(COMPARISON_CHANGE_EVENT, {
        detail: productData ? { productData } : undefined,
      })
    );
  }
}

/**
 * Get comparison cookie (CLIENT-SIDE ONLY)
 * Use this in Client Components, useEffect, and event handlers
 */
export function getComparisonCookie(): ComparisonCookie | null {
  if (typeof window === 'undefined') {
    // Should never be called on server - throw helpful error
    throw new Error(
      'getComparisonCookie() is client-only. Use getComparisonCookieServer() in Server Components.'
    );
  }

  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1];

  if (!cookieValue) return null;

  try {
    return JSON.parse(decodeURIComponent(cookieValue));
  } catch {
    return null;
  }
}

/**
 * Get comparison cookie (SERVER-SIDE ONLY)
 * Use this in Server Components - requires async/await
 * Pass the result of: await cookies()
 */
export async function getComparisonCookieServer(
  cookieStore: ReadonlyRequestCookies
): Promise<ComparisonCookie | null> {
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    return JSON.parse(cookie.value);
  } catch {
    return null;
  }
}

/**
 * Set comparison cookie (CLIENT-SIDE ONLY)
 */
export function setComparisonCookie(data: ComparisonCookie): void {
  if (typeof window === 'undefined') {
    throw new Error('setComparisonCookie can only be called on the client');
  }

  const cookieValue = encodeURIComponent(JSON.stringify(data));
  const secure = window.location.protocol === 'https:';

  document.cookie = `${COOKIE_NAME}=${cookieValue}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax${secure ? '; secure' : ''}`;
}

/**
 * Add product to comparison
 * @param productData - Optional product data for optimistic UI updates
 */
export function addProductToComparison(
  productId: string,
  categorySlug: string,
  productData?: unknown
): { success: boolean; error?: string } {
  const current = getComparisonCookie();

  // Check if already in comparison
  if (current?.productIds.includes(productId)) {
    return { success: false, error: 'Ten produkt jest już w porównaniu' };
  }

  // Check max products
  if (current && current.productIds.length >= MAX_PRODUCTS) {
    return {
      success: false,
      error: 'Możesz porównywać maksymalnie 3 produkty',
    };
  }

  // Check category match
  if (current && current.categorySlug !== categorySlug) {
    return {
      success: false,
      error: 'Możesz porównywać tylko produkty z tej samej kategorii',
    };
  }

  // Add product
  const newData: ComparisonCookie = {
    categorySlug,
    productIds: current ? [...current.productIds, productId] : [productId],
    timestamp: Date.now(),
  };

  setComparisonCookie(newData);
  dispatchComparisonChangeEvent(productData);
  return { success: true };
}

/**
 * Remove product from comparison
 */
export function removeProductFromComparison(productId: string): void {
  const current = getComparisonCookie();
  if (!current) return;

  const newProductIds = current.productIds.filter((id) => id !== productId);

  if (newProductIds.length === 0) {
    clearComparison();
  } else {
    setComparisonCookie({
      ...current,
      productIds: newProductIds,
      timestamp: Date.now(),
    });
    dispatchComparisonChangeEvent();
  }
}

/**
 * Clear all products from comparison
 */
export function clearComparison(): void {
  if (typeof window === 'undefined') {
    throw new Error('clearComparison can only be called on the client');
  }

  document.cookie = `${COOKIE_NAME}=; max-age=0; path=/`;
  dispatchComparisonChangeEvent();
}

/**
 * Check if product is in comparison
 */
export function isProductInComparison(productId: string): boolean {
  const current = getComparisonCookie();
  return current?.productIds.includes(productId) ?? false;
}

/**
 * Get comparison count
 */
export function getComparisonCount(): number {
  const current = getComparisonCookie();
  return current?.productIds.length ?? 0;
}
