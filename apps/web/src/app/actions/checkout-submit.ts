'use server';

import type { CartState } from '@/src/global/b2c/cart/types';
import type { CheckoutSubmitInput } from '@/src/global/b2c/checkout/types';
import { submitCheckoutOrder } from '@/src/global/b2c/checkout/server/submit-checkout';

export async function submitCheckout(
  input: CheckoutSubmitInput,
  cart: CartState,
) {
  return submitCheckoutOrder({
    input,
    cart,
  });
}

export type { CheckoutSubmitResult } from '@/src/global/b2c/checkout/server/types';
