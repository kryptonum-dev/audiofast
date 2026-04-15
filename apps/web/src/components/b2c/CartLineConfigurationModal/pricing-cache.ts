import type { FetchCartLinePricingResult } from '@/src/global/b2c/cart/cart-pricing-result';

export type CartLinePricingCacheEntry =
  | {
      status: 'idle' | 'loading';
    }
  | FetchCartLinePricingResult;
