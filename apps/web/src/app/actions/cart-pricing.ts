'use server';

import { fetchProductPricing } from '@/src/global/supabase/queries';
import type { CompletePricingData } from '@/src/global/supabase/types';

export type FetchCartLinePricingResult =
  | {
      status: 'found';
      pricingData: CompletePricingData;
    }
  | {
      status: 'not_found';
      message: string;
    }
  | {
      status: 'error';
      message: string;
    };

const CART_LINE_PRICING_ERROR_MESSAGE =
  'Nie udało się wczytać aktualnej konfiguracji tego produktu.';
const CART_LINE_PRICING_NOT_FOUND_MESSAGE =
  'Ta konfiguracja produktu nie jest już dostępna.';

function extractPricingLookupSlug(productKey: string): string | null {
  const normalizedKey = productKey.trim();

  if (!normalizedKey || !normalizedKey.includes('/')) {
    return null;
  }

  const segments = normalizedKey.split('/').filter(Boolean);
  return segments.at(-1) ?? null;
}

export async function fetchCartLinePricing(
  productKey: string,
): Promise<FetchCartLinePricingResult> {
  const productSlug = extractPricingLookupSlug(productKey);

  if (!productSlug) {
    return {
      status: 'error',
      message: CART_LINE_PRICING_ERROR_MESSAGE,
    };
  }

  try {
    const pricingData = await fetchProductPricing(productSlug);

    if (!pricingData) {
      return {
        status: 'not_found',
        message: CART_LINE_PRICING_NOT_FOUND_MESSAGE,
      };
    }

    return {
      status: 'found',
      pricingData,
    };
  } catch (error) {
    console.error('Unexpected cart pricing lookup failure.', error);

    return {
      status: 'error',
      message: CART_LINE_PRICING_ERROR_MESSAGE,
    };
  }
}
