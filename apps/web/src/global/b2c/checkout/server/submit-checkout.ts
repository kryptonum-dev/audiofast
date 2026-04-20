import { BASE_URL } from '@/src/global/constants';
import { applyCartRevalidation } from '@/src/global/b2c/cart/cart-revalidation';
import type { CartLineIssue, CartState } from '@/src/global/b2c/cart/types';
import { revalidateCartLines } from '@/src/global/b2c/cart/server/revalidation';

import {
  createCheckoutCartEmptyError,
  createCheckoutCartInvalidError,
  createCheckoutCartStaleError,
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
import { validateCheckoutCart } from '../cart';
import { validateCheckoutSubmitInput } from '../validation';

import { loadCheckoutAuthContext } from './auth-context';
import { generateNextCheckoutOrderNumber } from './order-number';
import {
  CheckoutPersistenceError,
  persistCheckoutOrder,
} from './persistence';
import {
  createCheckoutSubmitFailure,
  type CheckoutSubmitResult,
} from './types';

const CHECKOUT_P24_RETURN_PATH = '/podziekowania-za-zakup/';
const CHECKOUT_P24_STATUS_PATH = '/api/platnosci/przelewy24/status/';
const ORDER_NUMBER_RETRY_LIMIT = 3;

function serializeLineIssues(issues: CartLineIssue[]) {
  return issues.map((issue) => ({
    code: issue.code,
    blocking: issue.blocking,
    message: issue.message,
  }));
}

function didCartLineChange(original: CartState['lines'][number], next: CartState['lines'][number]): boolean {
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

  return (
    JSON.stringify(serializeLineIssues(original.issues)) !==
    JSON.stringify(serializeLineIssues(next.issues))
  );
}

function didCouponStateChange(
  original: CartState['coupon'],
  next: CartState['coupon'],
): boolean {
  return JSON.stringify(original) !== JSON.stringify(next);
}

function didCartTruthChange(
  original: CartState,
  next: CartState,
): boolean {
  if (original.lines.length !== next.lines.length) {
    return true;
  }

  for (let index = 0; index < original.lines.length; index += 1) {
    const originalLine = original.lines[index];
    const nextLine = next.lines[index];

    if (!originalLine || !nextLine || didCartLineChange(originalLine, nextLine)) {
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

  try {
    const revalidationResults = await revalidateCartLines(args.cart.lines);
    revalidatedCart = applyCartRevalidation(args.cart, revalidationResults);

    if (revalidatedCart.lines.length === 0) {
      return createCheckoutSubmitFailure(
        createCheckoutCartEmptyError(),
        revalidatedCart,
      );
    }

    if (didCartTruthChange(args.cart, revalidatedCart)) {
      return createCheckoutSubmitFailure(
        createCheckoutCartStaleError(),
        revalidatedCart,
      );
    }

    const cartValidation = validateCheckoutCart(revalidatedCart);

    if (!cartValidation.isReady) {
      if (cartValidation.blockingReasonCodes.includes('empty_cart')) {
        return createCheckoutSubmitFailure(
          createCheckoutCartEmptyError(),
          revalidatedCart,
        );
      }

      return createCheckoutSubmitFailure(
        createCheckoutCartInvalidError(cartValidation.blockingReasonCodes),
        revalidatedCart,
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
      );
    }

    const summary = buildCheckoutOrderSummary(
      revalidatedCart,
      cartValidation.validLines,
    );
    const profilePersistence = decideCheckoutProfilePersistence(
      authContext.sessionContext,
      authContext.customerProfile,
      validationResult.value,
    );
    const createdAt = new Date().toISOString();
    const orderDraft = buildCheckoutOrderDraft({
      input: validationResult.value,
      summary,
      sessionContext: authContext.sessionContext,
      profilePersistence,
      createdAt,
    });

    if (orderDraft.items.length === 0) {
      return createCheckoutSubmitFailure(
        createCheckoutOrderDraftInvalidError(),
        revalidatedCart,
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
      );
    }

    const paymentUrls = buildCheckoutPaymentUrls();
    const paymentRegistrationInput = buildP24TransactionRegistrationInput({
      orderId: persistedOrder.orderId,
      orderNumber: persistedOrder.orderNumber,
      orderDraft,
      urlReturn: paymentUrls.urlReturn,
      urlStatus: paymentUrls.urlStatus,
    });

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
    );
  }
}
