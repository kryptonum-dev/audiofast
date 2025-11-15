'use server';

import type { ComparisonProduct } from '@/src/global/comparison/types';
import { sanityFetch } from '@/src/global/sanity/client';
import {
  queryAllCategoryProductsForComparison,
  queryComparisonProductsFull,
  queryComparisonProductsMinimal,
} from '@/src/global/sanity/query';
import type { ProductType } from '@/src/global/types';

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
    return result;
  } catch (error) {
    console.error('Error fetching comparison products:', error);
    return null;
  }
}

/**
 * Server Action to fetch comparison products with full technical data
 * Used for the comparison page
 * @param productIds - Array of product IDs to fetch
 * @returns Array of comparison products or null if error
 */
export async function fetchComparisonProductsFull(
  productIds: string[]
): Promise<ComparisonProduct[] | null> {
  try {
    const result = await sanityFetch<ComparisonProduct[]>({
      query: queryComparisonProductsFull,
      params: { productIds },
      tags: ['comparison'],
    });
    return result;
  } catch (error) {
    console.error('Error fetching full comparison products:', error);
    return null;
  }
}

/**
 * Server Action to fetch ALL products from a category with FULL data
 * Fetches complete product data including technical specs for instant comparison
 * @param categorySlug - Category slug to fetch products from
 * @returns Array of comparison products with full data or empty array if error
 */
export async function fetchAllCategoryProducts(
  categorySlug: string
): Promise<ComparisonProduct[]> {
  try {
    const result = await sanityFetch<ComparisonProduct[]>({
      query: queryAllCategoryProductsForComparison,
      params: { categorySlug },
      tags: ['comparison', 'products'],
    });
    return result || [];
  } catch (error) {
    console.error('Error fetching category products:', error);
    return [];
  }
}
