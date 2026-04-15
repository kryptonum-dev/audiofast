import type { FetchCartLinePricingResult } from '@/src/app/actions/cart-pricing';

export type CartLinePricingCacheEntry =
  | {
      status: 'idle' | 'loading';
    }
  | FetchCartLinePricingResult;
