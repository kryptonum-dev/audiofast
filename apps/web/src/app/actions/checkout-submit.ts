'use server';

import { headers } from 'next/headers';

import type {
  CartLineRevalidation,
  CartState,
} from '@/src/global/b2c/cart/types';
import {
  type CheckoutDomainError,
  createCheckoutInternalError,
} from '@/src/global/b2c/checkout/errors';
import type { P24TransactionRegistrationResult } from '@/src/global/b2c/checkout/payment-contracts';
import { releaseCpoReservationsForOrder } from '@/src/global/b2c/checkout/server/cpo-availability';
import { completeZeroTotalCheckoutPayment } from '@/src/global/b2c/checkout/server/payment-zero-total';
import { startCheckoutPayment } from '@/src/global/b2c/checkout/server/start-payment';
import { submitCheckoutOrder } from '@/src/global/b2c/checkout/server/submit-checkout';
import { createCheckoutSubmitFailure } from '@/src/global/b2c/checkout/server/types';
import type { CheckoutSubmitInput } from '@/src/global/b2c/checkout/types';

type CheckoutSubmitActionSuccessValue = {
  orderId: string;
  orderNumber: string;
  redirectUrl: string;
  registration: P24TransactionRegistrationResult | null;
  wasAlreadyPaid: boolean;
};

type CheckoutSubmitActionFailure = {
  ok: false;
  error: CheckoutDomainError;
  revalidatedCart: CartState | null;
  revalidationResults: CartLineRevalidation[] | null;
};

type CheckoutSubmitActionResult =
  | {
      ok: true;
      value: CheckoutSubmitActionSuccessValue;
    }
  | CheckoutSubmitActionFailure;

function getFirstForwardedHeaderValue(value: string | null): string | null {
  const firstValue = value?.split(',')[0]?.trim();

  return firstValue && firstValue.length > 0 ? firstValue : null;
}

function resolveOriginHeader(value: string | null): string | null {
  const origin = getFirstForwardedHeaderValue(value);

  if (!origin) {
    return null;
  }

  try {
    const url = new URL(origin);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function resolveOriginFromHeaders(headerList: Headers): string | null {
  const origin = resolveOriginHeader(headerList.get('origin'));

  if (origin) {
    return origin;
  }

  const forwardedHost = getFirstForwardedHeaderValue(
    headerList.get('x-forwarded-host'),
  );
  const host =
    forwardedHost ?? getFirstForwardedHeaderValue(headerList.get('host'));

  if (!host) {
    return null;
  }

  const protocol =
    getFirstForwardedHeaderValue(headerList.get('x-forwarded-proto')) ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https');

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

async function resolveCheckoutRequestOrigin(): Promise<string | null> {
  try {
    return resolveOriginFromHeaders(await headers());
  } catch {
    return null;
  }
}

export async function submitCheckout(
  input: CheckoutSubmitInput,
  cart: CartState,
): Promise<CheckoutSubmitActionResult> {
  const requestOrigin = await resolveCheckoutRequestOrigin();
  const checkoutResult = await submitCheckoutOrder({
    input,
    cart,
    requestOrigin,
  });

  if (!checkoutResult.ok) {
    return checkoutResult;
  }

  if (checkoutResult.value.paymentRegistrationInput === null) {
    try {
      return {
        ok: true,
        value: await completeZeroTotalCheckoutPayment({
          order: checkoutResult.value,
          redirectUrl:
            checkoutResult.value.zeroTotalRedirectUrl ??
            `/podziekowania-za-zakup/${encodeURIComponent(
              checkoutResult.value.orderNumber,
            )}/`,
        }),
      };
    } catch (error) {
      await releaseCpoReservationsForOrder({
        orderDraft: checkoutResult.value.orderDraft,
        orderNumber: checkoutResult.value.orderNumber,
        paymentSessionId: checkoutResult.value.paymentSessionId,
      }).catch((releaseError) => {
        console.error(
          'Failed to release CPO reservation after zero-total payment confirmation failure.',
          {
            orderId: checkoutResult.value.orderId,
            orderNumber: checkoutResult.value.orderNumber,
            error: releaseError,
          },
        );
      });

      console.error('Failed to complete zero-total checkout payment.', {
        orderId: checkoutResult.value.orderId,
        orderNumber: checkoutResult.value.orderNumber,
        error,
      });

      return createCheckoutSubmitFailure(createCheckoutInternalError());
    }
  }

  const paymentStartResult = await startCheckoutPayment({
    paymentRegistrationInput: checkoutResult.value.paymentRegistrationInput,
  });

  if (!paymentStartResult.ok) {
    await releaseCpoReservationsForOrder({
      orderDraft: checkoutResult.value.orderDraft,
      orderNumber: checkoutResult.value.orderNumber,
      paymentSessionId: checkoutResult.value.paymentSessionId,
    }).catch((error) => {
      console.error(
        'Failed to release CPO reservation after payment start failure.',
        {
          orderId: checkoutResult.value.orderId,
          orderNumber: checkoutResult.value.orderNumber,
          error,
        },
      );
    });

    return createCheckoutSubmitFailure(paymentStartResult.error);
  }

  return {
    ok: true,
    value: paymentStartResult.value,
  };
}
