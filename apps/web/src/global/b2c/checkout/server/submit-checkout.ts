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
  createCheckoutPaymentAmountTooHighError,
} from '../errors';
import { buildCheckoutOrderDraft } from '../order-draft';
import {
  buildP24PaymentSessionId,
  buildP24TransactionRegistrationInput,
} from '../payment-contracts';
import { isOnlinePaymentAmountOverLimit } from '../payment-limit';
import { decideCheckoutProfilePersistence } from '../profile';
import { buildCheckoutOrderSummary } from '../summary';
import type { CheckoutSubmitInput } from '../types';
import { validateCheckoutSubmitInput } from '../validation';
import { loadCheckoutAuthContext } from './auth-context';
import {
  CpoAvailabilityError,
  reserveCpoItemsForOrder,
} from './cpo-availability';
import { generateNextCheckoutOrderNumber } from './order-number';
import { getP24Mode } from './p24-config';
import {
  CheckoutPersistenceError,
  cleanupCheckoutOrder,
  persistCheckoutOrder,
} from './persistence';
import {
  type CheckoutSubmitResult,
  createCheckoutSubmitFailure,
} from './types';

const CHECKOUT_P24_RETURN_PATH = '/podziekowania-za-zakup/';
const CHECKOUT_P24_STATUS_PATH = '/api/payment/status/';
const ORDER_NUMBER_RETRY_LIMIT = 3;
const P24_STATUS_CALLBACK_BASE_URL_ENV = 'P24_STATUS_CALLBACK_BASE_URL';

function buildCheckoutReturnPath(orderNumber: string): string {
  return `${CHECKOUT_P24_RETURN_PATH}${encodeURIComponent(orderNumber)}/`;
}

function serializeLineIssues(issues: CartLineIssue[]) {
  return issues.map((issue) => ({
    code: issue.code,
    blocking: issue.blocking,
    message: issue.message,
  }));
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;

    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function resolveP24StatusCallbackBaseUrl(fallbackBaseUrl: string): string {
  const configuredBaseUrl =
    process.env[P24_STATUS_CALLBACK_BASE_URL_ENV]?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (getP24Mode() !== 'mock' && isLocalhostOrigin(fallbackBaseUrl)) {
    console.warn('P24 status callback URL is using localhost.', {
      urlStatus: new URL(CHECKOUT_P24_STATUS_PATH, fallbackBaseUrl).toString(),
      expectedEnv: P24_STATUS_CALLBACK_BASE_URL_ENV,
      reason:
        'Przelewy24 server callbacks cannot reach localhost. Use an HTTPS tunnel or deployed URL for local sandbox testing.',
    });
  }

  return fallbackBaseUrl;
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

function buildCpoUnavailableRevalidationResults(
  cart: CartState,
  failedProductKeys: string[],
  currentResults: CartLineRevalidation[],
): CartLineRevalidation[] {
  const failedProductKeySet = new Set(failedProductKeys);

  return currentResults.map((result) => {
    const line = cart.lines.find(
      (candidate) => candidate.lineId === result.lineId,
    );

    if (line?.lineType !== 'cpo' || !failedProductKeySet.has(line.productKey)) {
      return result;
    }

    return {
      lineId: line.lineId,
      lineType: 'cpo',
      isBuyable: false,
      availabilityStatus:
        typeof line.availabilityStatus === 'string'
          ? line.availabilityStatus
          : 'on_hold',
      unitPriceCents: line.unitPriceCents,
    };
  });
}

function buildCheckoutPaymentUrls(args: {
  origin?: string | null;
  orderNumber: string;
}) {
  const baseUrl = args.origin ?? BASE_URL;
  const statusBaseUrl = resolveP24StatusCallbackBaseUrl(baseUrl);

  return {
    urlReturn: new URL(
      buildCheckoutReturnPath(args.orderNumber),
      baseUrl,
    ).toString(),
    urlStatus: new URL(CHECKOUT_P24_STATUS_PATH, statusBaseUrl).toString(),
  };
}

export async function submitCheckoutOrder(args: {
  input: CheckoutSubmitInput;
  cart: CartState;
  requestOrigin?: string | null;
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

    if (isOnlinePaymentAmountOverLimit(summary.grandTotalCents)) {
      return createCheckoutSubmitFailure(
        createCheckoutPaymentAmountTooHighError(),
        revalidatedCart,
        revalidationResults,
      );
    }

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
      const paymentSessionId = buildP24PaymentSessionId(orderNumber);

      try {
        persistedOrder = await persistCheckoutOrder({
          orderNumber,
          paymentSessionId,
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

    try {
      await reserveCpoItemsForOrder({
        orderDraft,
        orderNumber: persistedOrder.orderNumber,
        paymentSessionId: persistedOrder.paymentSessionId,
      });
    } catch (error) {
      await cleanupCheckoutOrder(persistedOrder.orderId);

      if (
        error instanceof CpoAvailabilityError &&
        (error.code === 'not_available' || error.code === 'write_conflict')
      ) {
        const cpoConflictResults = buildCpoUnavailableRevalidationResults(
          revalidatedCart,
          error.productKeys,
          revalidationResults,
        );

        return createCheckoutSubmitFailure(
          createCheckoutCartInvalidError(['blocking_line_issues']),
          applyCartRevalidation(revalidatedCart, cpoConflictResults),
          cpoConflictResults,
        );
      }

      throw error;
    }

    const paymentUrls = buildCheckoutPaymentUrls({
      origin: args.requestOrigin,
      orderNumber: persistedOrder.orderNumber,
    });
    const paymentRegistrationInput = buildP24TransactionRegistrationInput({
      orderId: persistedOrder.orderId,
      orderNumber: persistedOrder.orderNumber,
      paymentSessionId: persistedOrder.paymentSessionId,
      orderDraft,
      urlReturn: paymentUrls.urlReturn,
      urlStatus: paymentUrls.urlStatus,
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
