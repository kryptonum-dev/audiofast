'use server';

import { sanityFetch } from '@/src/global/sanity/client';
import { queryComparisonProductsMinimal } from '@/src/global/sanity/query';
import type { ProductType } from '@/src/global/types';

/**
 * Minimal product type for floating box (without technicalData)
 */

/**
 * Server Action to fetch comparison products (minimal data)
 * Can be called from Client Components
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
      tags: ['comparison'],
    });
    setTimeout(() => {
      return result;
    }, 3000);
    return result;
  } catch (error) {
    console.error('Error fetching comparison products:', error);
    return null;
  }
}
