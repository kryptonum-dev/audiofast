'use server';

import {
  buildCartProductRouteSlug,
  extractCartProductSlug,
} from '@/src/global/b2c/cart/cart-product-key';
import {
  QUICK_ADD_ERROR_MESSAGE,
  QUICK_ADD_UNAVAILABLE_MESSAGES,
  type QuickAddResolution,
  resolveQuickAdd,
} from '@/src/global/b2c/cart/quick-add';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { queryProductQuickAddBySlug } from '@/src/global/sanity/query';
import type { QueryProductQuickAddBySlugResult } from '@/src/global/sanity/sanity.types';
import { fetchProductPricing } from '@/src/global/supabase/queries';

export type LoadProductQuickAddResult =
  | QuickAddResolution
  | {
      status: 'error';
      message: string;
    };

// Server actions are public endpoints: accept only a plain product slug
// ("playermini") or its product route ("/produkty/playermini/").
const PRODUCT_SLUG_PATTERN = /^[a-z0-9-]+$/;
const MAX_PRODUCT_SLUG_LENGTH = 200;
const MAX_PRODUCT_SLUG_INPUT_LENGTH = 256;

function normalizeQuickAddProductSlug(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmedInput = input.trim();

  if (!trimmedInput || trimmedInput.length > MAX_PRODUCT_SLUG_INPUT_LENGTH) {
    return null;
  }

  const productSlug = trimmedInput.includes('/')
    ? extractCartProductSlug(trimmedInput)
    : trimmedInput.toLowerCase();

  if (
    !productSlug ||
    productSlug.length > MAX_PRODUCT_SLUG_LENGTH ||
    !PRODUCT_SLUG_PATTERN.test(productSlug)
  ) {
    return null;
  }

  return productSlug;
}

/**
 * Loads everything a product tile needs to add the product to the cart:
 * Supabase pricing and a minimal Sanity snapshot, both read through the same
 * caches (and cache tags) as the product page. The returned mode tells the
 * tile whether to add straight away or open the configuration popup.
 */
export async function loadProductQuickAdd(
  productSlug: string,
): Promise<LoadProductQuickAddResult> {
  const normalizedSlug = normalizeQuickAddProductSlug(productSlug);
  const routeSlug = normalizedSlug
    ? buildCartProductRouteSlug(normalizedSlug, 'standard')
    : null;

  if (!normalizedSlug || !routeSlug) {
    return {
      status: 'unavailable',
      reason: 'not_found',
      message: QUICK_ADD_UNAVAILABLE_MESSAGES.not_found,
    };
  }

  try {
    const [pricingData, product] = await Promise.all([
      fetchProductPricing(normalizedSlug),
      sanityFetch<QueryProductQuickAddBySlugResult>({
        query: queryProductQuickAddBySlug,
        params: { slug: routeSlug },
        tags: ['product', `product:${normalizedSlug}`],
      }),
    ]);

    return resolveQuickAdd({ product, pricingData });
  } catch (error) {
    console.error('Unexpected product quick add lookup failure.', error);

    return {
      status: 'error',
      message: QUICK_ADD_ERROR_MESSAGE,
    };
  }
}
