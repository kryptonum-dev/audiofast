import {
  applyCartRevalidation,
  stripManagedCartLineIssues,
} from '@/src/global/b2c/cart/cart-revalidation';
import { revalidateCartLines } from '@/src/global/b2c/cart/server/revalidation';
import type {
  CartLineIssue,
  CartLineRevalidation,
  CartState,
} from '@/src/global/b2c/cart/types';
import { BASE_URL } from '@/src/global/constants';
import { subscribeToNewsletter } from '@/src/global/mailchimp/subscribe';

import { validateCheckoutCart } from '../cart';
import {
  createCheckoutCartEmptyError,
  createCheckoutCartInvalidError,
  createCheckoutCartPriceUpdatedError,
  createCheckoutEmailLockedMismatchError,
  createCheckoutFormInvalidError,
  createCheckoutInternalError,
  createCheckoutOrderDraftInvalidError,
} from '../errors';
import { buildCheckoutOrderDraft } from '../order-draft';
import { buildP24TransactionRegistrationInput } from '../payment-contracts';
import { decideCheckoutProfilePersistence } from '../profile';
import { buildCheckoutOrderSummary } from '../summary';
import type { CheckoutSubmitInput } from '../types';
import { validateCheckoutSubmitInput } from '../validation';
import { loadCheckoutAuthContext } from './auth-context';
import { generateNextCheckoutOrderNumber } from './order-number';
import { CheckoutPersistenceError, persistCheckoutOrder } from './persistence';
import {
  type CheckoutSubmitResult,
  createCheckoutSubmitFailure,
} from './types';

const CHECKOUT_P24_RETURN_PATH = '/podziekowania-za-zakup/';
const CHECKOUT_P24_STATUS_PATH = '/api/payment/status/';
const ORDER_NUMBER_RETRY_LIMIT = 3;

function serializeLineIssues(issues: CartLineIssue[]) {
  return issues.map((issue) => ({
    code: issue.code,
    blocking: issue.blocking,
    message: issue.message,
  }));
}

function didCartLineChange(
  original: CartState['lines'][number],
  next: CartState['lines'][number],
): boolean {
  if (
    original.lineId !== next.lineId ||
    original.lineType !== next.lineType ||
    original.unitPriceCents !== next.unitPriceCents
  ) {
    return true;
  }

  if (
    original.lineType === 'cpo' &&
    next.lineType === 'cpo' &&
    original.availabilityStatus !== next.availabilityStatus
  ) {
    return true;
  }

  // Managed issue codes (e.g. price_changed, not_buyable, configuration_invalid,
  // cpo_unavailable) are deterministically (re)applied by the revalidation pass
  // itself, so we must not treat differences on those between the client-sent
  // cart and the freshly revalidated cart as "truth drift" — otherwise a client
  // that already applied a soft revalidation will re-trigger cart_price_updated
  // indefinitely on every resubmit.
  return (
    JSON.stringify(
      serializeLineIssues(stripManagedCartLineIssues(original).issues),
    ) !==
    JSON.stringify(serializeLineIssues(stripManagedCartLineIssues(next).issues))
  );
}

function didCouponStateChange(
  original: CartState['coupon'],
  next: CartState['coupon'],
): boolean {
  return JSON.stringify(original) !== JSON.stringify(next);
}

function didCartTruthChange(original: CartState, next: CartState): boolean {
  if (original.lines.length !== next.lines.length) {
    return true;
  }

  for (let index = 0; index < original.lines.length; index += 1) {
    const originalLine = original.lines[index];
    const nextLine = next.lines[index];

    if (
      !originalLine ||
      !nextLine ||
      didCartLineChange(originalLine, nextLine)
    ) {
      return true;
    }
  }

  return didCouponStateChange(original.coupon, next.coupon);
}

function buildCheckoutPaymentUrls() {
  return {
    urlReturn: new URL(CHECKOUT_P24_RETURN_PATH, BASE_URL).toString(),
    urlStatus: new URL(CHECKOUT_P24_STATUS_PATH, BASE_URL).toString(),
  };
}

export async function submitCheckoutOrder(args: {
  input: CheckoutSubmitInput;
  cart: CartState;
}): Promise<CheckoutSubmitResult> {
  const authContext = await loadCheckoutAuthContext();

  let revalidatedCart: CartState | null = null;
  let revalidationResults: CartLineRevalidation[] | null = null;

  try {
    revalidationResults = await revalidateCartLines(args.cart.lines);
    revalidatedCart = applyCartRevalidation(args.cart, revalidationResults);

    if (revalidatedCart.lines.length === 0) {
      return createCheckoutSubmitFailure(
        createCheckoutCartEmptyError(),
        revalidatedCart,
        revalidationResults,
      );
    }

    // Hard-block first: availability / configuration / CPO failures must
    // force the customer back to the cart before anything else happens.
    const cartValidation = validateCheckoutCart(revalidatedCart);

    if (!cartValidation.isReady) {
      if (cartValidation.blockingReasonCodes.includes('empty_cart')) {
        return createCheckoutSubmitFailure(
          createCheckoutCartEmptyError(),
          revalidatedCart,
          revalidationResults,
        );
      }

      return createCheckoutSubmitFailure(
        createCheckoutCartInvalidError(cartValidation.blockingReasonCodes),
        revalidatedCart,
        revalidationResults,
      );
    }

    // Soft path: lines are still buyable but pricing or coupon state drifted.
    // The customer can accept the refreshed totals and resubmit without
    // navigating back to the cart.
    if (didCartTruthChange(args.cart, revalidatedCart)) {
      return createCheckoutSubmitFailure(
        createCheckoutCartPriceUpdatedError(),
        revalidatedCart,
        revalidationResults,
      );
    }

    const validationResult = validateCheckoutSubmitInput(
      args.input,
      authContext.sessionContext,
    );

    if (!validationResult.isValid) {
      return createCheckoutSubmitFailure(
        createCheckoutFormInvalidError(validationResult.errors),
        revalidatedCart,
        revalidationResults,
      );
    }

    if (
      authContext.isEmailLocked &&
      authContext.sessionContext.authenticatedEmail &&
      validationResult.value.contact.email !==
        authContext.sessionContext.authenticatedEmail
    ) {
      return createCheckoutSubmitFailure(
        createCheckoutEmailLockedMismatchError(),
        revalidatedCart,
        revalidationResults,
      );
    }

    const summary = buildCheckoutOrderSummary(
      revalidatedCart,
      cartValidation.validLines,
    );
    const profilePersistenceDecision = decideCheckoutProfilePersistence(
      authContext.sessionContext,
      authContext.customerProfile,
      validationResult.value,
    );
    const createdAt = new Date().toISOString();
    const orderDraft = buildCheckoutOrderDraft({
      input: validationResult.value,
      summary,
      sessionContext: authContext.sessionContext,
      profilePersistenceDecision,
      createdAt,
    });

    if (orderDraft.items.length === 0) {
      return createCheckoutSubmitFailure(
        createCheckoutOrderDraftInvalidError(),
        revalidatedCart,
        revalidationResults,
      );
    }

    let persistedOrder = null;

    for (let attempt = 0; attempt < ORDER_NUMBER_RETRY_LIMIT; attempt += 1) {
      const orderNumber = await generateNextCheckoutOrderNumber(
        new Date(createdAt),
      );

      try {
        persistedOrder = await persistCheckoutOrder({
          orderNumber,
          orderDraft,
        });
        break;
      } catch (error) {
        if (
          error instanceof CheckoutPersistenceError &&
          error.code === 'duplicate_order_number' &&
          attempt < ORDER_NUMBER_RETRY_LIMIT - 1
        ) {
          continue;
        }

        throw error;
      }
    }

    if (!persistedOrder) {
      return createCheckoutSubmitFailure(
        createCheckoutInternalError(),
        revalidatedCart,
        revalidationResults,
      );
    }

    const paymentUrls = buildCheckoutPaymentUrls();
    const paymentRegistrationInput = buildP24TransactionRegistrationInput({
      orderId: persistedOrder.orderId,
      orderNumber: persistedOrder.orderNumber,
      orderDraft,
      urlReturn: paymentUrls.urlReturn,
      urlStatus: paymentUrls.urlStatus,
      mockScenarioId: validationResult.value.mockPaymentScenarioId ?? null,
    });

    if (validationResult.value.newsletterOptIn) {
      try {
        const newsletterResult = await subscribeToNewsletter(
          validationResult.value.contact.email,
        );

        if (!newsletterResult.success) {
          console.error('Checkout newsletter subscription failed.', {
            orderId: persistedOrder.orderId,
            orderNumber: persistedOrder.orderNumber,
            email: validationResult.value.contact.email,
            reason: newsletterResult.message,
          });
        }
      } catch (error) {
        console.error('Checkout newsletter subscription threw unexpectedly.', {
          orderId: persistedOrder.orderId,
          orderNumber: persistedOrder.orderNumber,
          email: validationResult.value.contact.email,
          error,
        });
      }
    }

    return {
      ok: true,
      value: {
        ...persistedOrder,
        input: validationResult.value,
        revalidatedCart,
        paymentRegistrationInput,
      },
    };
  } catch (error) {
    console.error('Failed to submit checkout order.', error);

    return createCheckoutSubmitFailure(
      createCheckoutInternalError(),
      revalidatedCart,
      revalidationResults,
    );
  }
}
