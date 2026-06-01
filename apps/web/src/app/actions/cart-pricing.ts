'use server';

import {
  CART_LINE_PRICING_ERROR_MESSAGE,
  createCartLinePricingResult,
  type FetchCartLinePricingResult,
} from '@/src/global/b2c/cart/cart-pricing-result';
import { extractCartProductSlug } from '@/src/global/b2c/cart/cart-product-key';
import { fetchProductPricing } from '@/src/global/supabase/queries';

export async function fetchCartLinePricing(
  productKey: string,
): Promise<FetchCartLinePricingResult> {
  const productSlug = extractCartProductSlug(productKey);

  if (!productSlug) {
    return createCartLinePricingResult(productKey, null);
  }

  try {
    const pricingData = await fetchProductPricing(productSlug);
    return createCartLinePricingResult(productKey, pricingData);
  } catch (error) {
    console.error('Unexpected cart pricing lookup failure.', error);

    return {
      status: 'error',
      message: CART_LINE_PRICING_ERROR_MESSAGE,
    };
  }
}
