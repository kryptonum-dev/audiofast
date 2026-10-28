'use server';

import { MAX_COMPARISON_PRODUCTS } from '@/src/global/comparison/comparison-helpers';
import { sanityFetchPublished } from '@/src/global/sanity/live';
import { queryComparisonProductsMinimal } from '@/src/global/sanity/query';
import type { ProductType } from '@/src/global/types';

/**
 * Server Action to fetch comparison products (minimal data)
 * Used by FloatingComparisonBox for quick product display
 * @param productIds - Array of product IDs to fetch
 * @returns Array of products or null if error
 */
export async function fetchComparisonProducts(
  productIds: unknown,
): Promise<ProductType[] | null> {
  // A server action is publicly invocable: accept only what the comparison box
  // can send (a short list of Sanity document ids), nothing else.
  if (!isValidProductIdList(productIds)) {
    return null;
  }

  try {
    const result = await sanityFetchPublished<ProductType[]>({
      requestTag: 'comparison.products-minimal',
      query: queryComparisonProductsMinimal,
      params: { productIds },
    });
    return result;
  } catch (error) {
    console.error('Error fetching comparison products:', error);
    return null;
  }
}

const SANITY_DOCUMENT_ID = /^[A-Za-z0-9._-]{1,128}$/;

function isValidProductIdList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_COMPARISON_PRODUCTS &&
    value.every(
      (id) =>
        typeof id === 'string' &&
        SANITY_DOCUMENT_ID.test(id) &&
        !id.startsWith('drafts.'),
    )
  );
}
