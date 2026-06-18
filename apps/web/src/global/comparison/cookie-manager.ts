import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

import { validateProductAddition } from './comparison-helpers';
import type { ComparisonCategory, ComparisonCookie } from './types';

const COOKIE_NAME = 'audiofast_comparison';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Legacy cookie shape (single category) kept for read-time migration.
 */
type LegacyComparisonCookie = {
  categorySlug?: string;
  categoryName?: string;
};

/**
 * Normalize a raw parsed cookie into the current {@link ComparisonCookie} shape.
 * Migrates legacy single-category cookies (`categorySlug`/`categoryName`) into
 * the array-based shape so old visitors keep a working comparison.
 */
function normalizeComparisonCookie(raw: unknown): ComparisonCookie | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<ComparisonCookie> & LegacyComparisonCookie;

  if (!Array.isArray(data.productIds)) return null;

  const productIds = data.productIds.filter(
    (id): id is string => typeof id === 'string',
  );
  const timestamp = typeof data.timestamp === 'number' ? data.timestamp : 0;

  // Current shape
  if (Array.isArray(data.categorySlugs)) {
    return {
      categorySlugs: data.categorySlugs.filter(
        (slug): slug is string => typeof slug === 'string',
      ),
      categoryNames:
        data.categoryNames && typeof data.categoryNames === 'object'
          ? data.categoryNames
          : undefined,
      productIds,
      timestamp,
    };
  }

  // Legacy single-category shape
  if (typeof data.categorySlug === 'string') {
    const slug = data.categorySlug;
    const name =
      typeof data.categoryName === 'string' ? data.categoryName : undefined;
    return {
      categorySlugs: slug ? [slug] : [],
      categoryNames: slug && name ? { [slug]: name } : undefined,
      productIds,
      timestamp,
    };
  }

  return { categorySlugs: [], productIds, timestamp };
}

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
      }),
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
      'getComparisonCookie() is client-only. Use getComparisonCookieServer() in Server Components.',
    );
  }

  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1];

  if (!cookieValue) return null;

  try {
    return normalizeComparisonCookie(
      JSON.parse(decodeURIComponent(cookieValue)),
    );
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
  cookieStore: ReadonlyRequestCookies,
): Promise<ComparisonCookie | null> {
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    return normalizeComparisonCookie(JSON.parse(cookie.value));
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

type AddProductOptions = {
  /**
   * Product name to personalize toasts.
   */
  productName?: string;
  /**
   * Optional product data for optimistic UI updates.
   */
  productData?: unknown;
};

/**
 * Add product to comparison.
 *
 * Accepts the product's FULL list of categories (a product can belong to more
 * than one). The product is accepted when its categories intersect the set of
 * categories shared by all products already in the comparison; the cookie then
 * stores the narrowed intersection.
 *
 * @param categories - All categories the product belongs to
 * @param options - Optional metadata for richer UX
 */
export function addProductToComparison(
  productId: string,
  categories: ComparisonCategory[],
  options?: AddProductOptions,
): { success: boolean; error?: string } {
  const productName = options?.productName;
  const productData = options?.productData;
  const current = getComparisonCookie();

  const validation = validateProductAddition(productId, categories, current, {
    productName,
  });
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const nextSlugs =
    validation.nextCategorySlugs ??
    categories.map((category) => category.slug).filter(Boolean);

  // Merge known category names, then keep only those for the surviving slugs.
  const mergedNames: Record<string, string> = {
    ...(current?.categoryNames ?? {}),
  };
  for (const category of categories) {
    if (category.slug && category.name) {
      mergedNames[category.slug] = category.name;
    }
  }
  const categoryNames: Record<string, string> = {};
  for (const slug of nextSlugs) {
    if (mergedNames[slug]) categoryNames[slug] = mergedNames[slug];
  }

  const newData: ComparisonCookie = {
    categorySlugs: nextSlugs,
    categoryNames:
      Object.keys(categoryNames).length > 0 ? categoryNames : undefined,
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
