import { extractCartProductSlug } from '@/src/global/b2c/cart/cart-product-key';
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

export const CART_LINE_PRICING_ERROR_MESSAGE =
  'Nie udało się wczytać aktualnej konfiguracji tego produktu.';
export const CART_LINE_PRICING_NOT_FOUND_MESSAGE =
  'Ta konfiguracja produktu nie jest już dostępna.';

export function createCartLinePricingResult(
  productKey: string,
  pricingData: CompletePricingData | null,
): FetchCartLinePricingResult {
  const productSlug = extractCartProductSlug(productKey);

  if (!productSlug) {
    return {
      status: 'error',
      message: CART_LINE_PRICING_ERROR_MESSAGE,
    };
  }

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
}
