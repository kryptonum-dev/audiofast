import {
  createCheckoutFailure,
  createCheckoutPaymentAmountTooHighError,
  createCheckoutPaymentRegistrationFailedError,
  createCheckoutPaymentVerificationFailedError,
  createCheckoutSuccess,
} from '../errors';
import type { P24TransactionRegistrationInput } from '../payment-contracts';
import { isOnlinePaymentAmountOverLimit } from '../payment-limit';
import { P24ClientError } from './p24-client';
import { getCheckoutPaymentProviderAdapter } from './payment-provider';
import { handleCheckoutPaymentStatusNotification } from './payment-status';
import type { StartCheckoutPaymentResult } from './types';

function buildCheckoutPaymentRedirectUrl(args: {
  registrationInput: P24TransactionRegistrationInput;
  registrationResult: Awaited<
    ReturnType<
      ReturnType<
        typeof getCheckoutPaymentProviderAdapter
      >['registerTransaction']
    >
  >;
  shouldUseProviderRedirect: boolean;
}): string {
  if (args.shouldUseProviderRedirect) {
    return args.registrationResult.redirectUrl;
  }

  return args.registrationInput.urlReturn;
}

export async function startCheckoutPayment(args: {
  paymentRegistrationInput: P24TransactionRegistrationInput;
}): Promise<StartCheckoutPaymentResult> {
  if (args.paymentRegistrationInput.amount <= 0) {
    return createCheckoutFailure(
      createCheckoutPaymentRegistrationFailedError(),
    );
  }

  if (isOnlinePaymentAmountOverLimit(args.paymentRegistrationInput.amount)) {
    return createCheckoutFailure(createCheckoutPaymentAmountTooHighError());
  }

  let registration: Awaited<
    ReturnType<
      ReturnType<
        typeof getCheckoutPaymentProviderAdapter
      >['registerTransaction']
    >
  >;
  const providerAdapter = getCheckoutPaymentProviderAdapter(
    args.paymentRegistrationInput.provider,
  );

  try {
    registration = await providerAdapter.registerTransaction(
      args.paymentRegistrationInput,
    );
    providerAdapter.buildReturnState({
      registrationInput: args.paymentRegistrationInput,
      registrationResult: registration,
    });
  } catch (error) {
    if (error instanceof P24ClientError) {
      console.error('Failed to register checkout payment.', {
        provider: providerAdapter.provider,
        orderId: args.paymentRegistrationInput.checkoutOrderId,
        orderNumber: args.paymentRegistrationInput.orderNumber,
        sessionId: args.paymentRegistrationInput.sessionId,
        code: error.code,
        status: error.status,
        responseCode: error.responseCode,
        responseBody: error.responseBody,
        message: error.message,
      });
    } else {
      console.error('Failed to register checkout payment.', error);
    }

    return createCheckoutFailure(
      createCheckoutPaymentRegistrationFailedError(),
    );
  }

  try {
    if (!providerAdapter.autoConfirmPaymentOnStart) {
      return createCheckoutSuccess({
        orderId: args.paymentRegistrationInput.checkoutOrderId,
        orderNumber: args.paymentRegistrationInput.orderNumber,
        redirectUrl: buildCheckoutPaymentRedirectUrl({
          registrationInput: args.paymentRegistrationInput,
          registrationResult: registration,
          shouldUseProviderRedirect: true,
        }),
        registration,
        wasAlreadyPaid: false,
      });
    }

    const notification = providerAdapter.buildStatusNotificationPayload({
      registrationInput: args.paymentRegistrationInput,
      registrationResult: registration,
    });
    const paymentStatus = await handleCheckoutPaymentStatusNotification({
      notification,
    });

    return createCheckoutSuccess({
      orderId: args.paymentRegistrationInput.checkoutOrderId,
      orderNumber: args.paymentRegistrationInput.orderNumber,
      redirectUrl: buildCheckoutPaymentRedirectUrl({
        registrationInput: args.paymentRegistrationInput,
        registrationResult: registration,
        shouldUseProviderRedirect: false,
      }),
      registration,
      wasAlreadyPaid: paymentStatus.wasAlreadyPaid,
    });
  } catch (error) {
    console.error('Failed to complete checkout payment confirmation.', {
      orderId: args.paymentRegistrationInput.checkoutOrderId,
      orderNumber: args.paymentRegistrationInput.orderNumber,
      provider: providerAdapter.provider,
      error,
    });

    return createCheckoutFailure(
      createCheckoutPaymentVerificationFailedError(),
    );
  }
}
