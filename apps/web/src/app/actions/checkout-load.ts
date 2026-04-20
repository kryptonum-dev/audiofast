'use server';

import { loadCheckoutPageData } from '@/src/global/b2c/checkout/server/load-checkout';

export async function loadCheckoutPage() {
  return loadCheckoutPageData();
}

export type { LoadCheckoutPageResult } from '@/src/global/b2c/checkout/server/types';
