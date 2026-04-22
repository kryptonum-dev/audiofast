'use server';

import type {
  CartLineRevalidation,
  CartState,
} from '@/src/global/b2c/cart/types';
import type { CheckoutDomainError } from '@/src/global/b2c/checkout/errors';
import type { P24TransactionRegistrationResult } from '@/src/global/b2c/checkout/payment-contracts';
import { startCheckoutPayment } from '@/src/global/b2c/checkout/server/start-payment';
import { submitCheckoutOrder } from '@/src/global/b2c/checkout/server/submit-checkout';
import { createCheckoutSubmitFailure } from '@/src/global/b2c/checkout/server/types';
import type { CheckoutSubmitInput } from '@/src/global/b2c/checkout/types';

export type CheckoutSubmitActionSuccessValue = {
  orderId: string;
  orderNumber: string;
  redirectUrl: string;
  registration: P24TransactionRegistrationResult;
  wasAlreadyPaid: boolean;
};

export type CheckoutSubmitActionFailure = {
  ok: false;
  error: CheckoutDomainError;
  revalidatedCart: CartState | null;
  revalidationResults: CartLineRevalidation[] | null;
};

export type CheckoutSubmitActionResult =
  | {
      ok: true;
      value: CheckoutSubmitActionSuccessValue;
    }
  | CheckoutSubmitActionFailure;

export async function submitCheckout(
  input: CheckoutSubmitInput,
  cart: CartState,
): Promise<CheckoutSubmitActionResult> {
  const checkoutResult = await submitCheckoutOrder({
    input,
    cart,
  });

  if (!checkoutResult.ok) {
    return checkoutResult;
  }

  const paymentStartResult = await startCheckoutPayment({
    paymentRegistrationInput: checkoutResult.value.paymentRegistrationInput,
  });

  if (!paymentStartResult.ok) {
    return createCheckoutSubmitFailure(paymentStartResult.error);
  }

  return {
    ok: true,
    value: paymentStartResult.value,
  };
}
