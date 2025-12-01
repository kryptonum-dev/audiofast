'use server';

import type {
  ComparisonProduct,
  EnabledParameter,
} from '@/src/global/comparison/types';
import { sanityFetch } from '@/src/global/sanity/fetch';
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
  enabledParameters: EnabledParameter[];
};

/**
 * Server Action to fetch comparison products (minimal data)
 * Used by FloatingComparisonBox for quick product display
 * @param productIds - Array of product IDs to fetch
 * @returns Array of products or null if error
 */
export async function fetchComparisonProducts(
  productIds: string[]
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
 * @param categorySlug - Category slug to fetch data for
 * @returns Object with products array and enabledParameters array
 */
export async function fetchComparisonPageData(
  categorySlug: string
): Promise<ComparisonPageData> {
  try {
    const result = await sanityFetch<{
      products: ComparisonProduct[] | null;
      enabledParameters: EnabledParameter[] | null;
    }>({
      query: queryComparisonPageData,
      params: { categorySlug },
      tags: ['product', 'comparatorConfig'],
    });

    return {
      products: result?.products || [],
      enabledParameters: result?.enabledParameters || [],
    };
  } catch (error) {
    console.error('Error fetching comparison page data:', error);
    return {
      products: [],
      enabledParameters: [],
    };
  }
}
