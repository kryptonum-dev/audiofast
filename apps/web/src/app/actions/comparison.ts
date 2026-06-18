'use server';

import type {
  ComparisonProduct,
  EnabledParameter,
} from '@/src/global/comparison/types';
import { sanityFetch, sanityFetchDynamic } from '@/src/global/sanity/fetch';
import {
  queryComparisonPageData,
  queryComparisonProductsMinimal,
} from '@/src/global/sanity/query';
import type { ProductType } from '@/src/global/types';

/**
 * Combined response type for comparison page data
 */
export type ComparisonPageData = {
  products: ComparisonProduct[];
  /**
   * Enabled comparison parameters for the shared category.
   * - `undefined` -> no comparator config exists for the category; the table
   *   falls back to showing ALL technical parameters of the compared products.
   * - `[]` -> a config exists but enables zero parameters (show nothing).
   * Keep this distinction; do not coerce `undefined`/`null` into `[]`.
   */
  enabledParameters: EnabledParameter[] | undefined;
};

/**
 * Server Action to fetch comparison products (minimal data)
 * Used by FloatingComparisonBox for quick product display
 * @param productIds - Array of product IDs to fetch
 * @returns Array of products or null if error
 */
export async function fetchComparisonProducts(
  productIds: string[],
): Promise<ProductType[] | null> {
  try {
    const result = await sanityFetch<ProductType[]>({
      query: queryComparisonProductsMinimal,
      params: { productIds },
      tags: ['product'],
    });
    return result;
  } catch (error) {
    console.error('Error fetching comparison products:', error);
    return null;
  }
}

/**
 * Server Action to fetch ALL comparison page data in a single query
 * Fetches both products and comparator config for a category
 *
 * Uses uncached fetch because:
 * - The comparison page is already dynamic (uses cookies)
 * - Comparator config changes should be reflected immediately
 * - No benefit to caching since the page won't be served from cache anyway
 *
 * @param categorySlugs - Shared category slugs of the comparison to fetch data for
 * @returns Object with products array and enabledParameters array
 */
export async function fetchComparisonPageData(
  categorySlugs: string[],
): Promise<ComparisonPageData> {
  try {
    const result = await sanityFetchDynamic<{
      products: ComparisonProduct[] | null;
      categoryConfigs: Array<{
        categorySlug: string | null;
        enabledParameters: EnabledParameter[] | null;
      }> | null;
    }>({
      query: queryComparisonPageData,
      params: { categorySlugs },
    });

    // The comparison can share more than one category (a product may belong to
    // several). Pick the parameter set deterministically: the first shared
    // category — in the cookie's order, which follows the first product's
    // editorial order and is preserved through intersection narrowing — that
    // actually has a comparator config. This avoids depending on the order
    // categoryConfigs happen to have in the Studio document.
    const configs = result?.categoryConfigs ?? [];
    const matched = categorySlugs
      .map((slug) => configs.find((config) => config.categorySlug === slug))
      .find((config) => config != null);

    return {
      products: result?.products || [],
      // No config for any shared category -> `undefined` so the table falls back
      // to showing ALL technical parameters. A matched config with an empty list
      // means "configured, show none" and stays `[]`.
      enabledParameters: matched
        ? (matched.enabledParameters ?? [])
        : undefined,
    };
  } catch (error) {
    console.error('Error fetching comparison page data:', error);
    return {
      products: [],
      enabledParameters: undefined,
    };
  }
}
