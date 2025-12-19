"use server";

import type {
  ComparisonProduct,
  EnabledParameter,
} from "@/src/global/comparison/types";
import { sanityFetch, sanityFetchDynamic } from "@/src/global/sanity/fetch";
import {
  queryComparisonPageData,
  queryComparisonProductsMinimal,
} from "@/src/global/sanity/query";
import type { ProductType } from "@/src/global/types";

/**
 * Combined response type for comparison page data
 */
export type ComparisonPageData = {
  products: ComparisonProduct[];
  enabledParameters: EnabledParameter[];
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
      tags: ["product"],
    });
    return result;
  } catch (error) {
    console.error("Error fetching comparison products:", error);
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
 * @param categorySlug - Category slug to fetch data for
 * @returns Object with products array and enabledParameters array
 */
export async function fetchComparisonPageData(
  categorySlug: string,
): Promise<ComparisonPageData> {
  try {
    const result = await sanityFetchDynamic<{
      products: ComparisonProduct[] | null;
      enabledParameters: EnabledParameter[] | null;
    }>({
      query: queryComparisonPageData,
      params: { categorySlug },
    });

    return {
      products: result?.products || [],
      enabledParameters: result?.enabledParameters || [],
    };
  } catch (error) {
    console.error("Error fetching comparison page data:", error);
    return {
      products: [],
      enabledParameters: [],
    };
  }
}
