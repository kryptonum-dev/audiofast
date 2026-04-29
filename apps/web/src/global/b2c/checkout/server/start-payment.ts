import {
  createCheckoutFailure,
  createCheckoutPaymentRegistrationFailedError,
  createCheckoutPaymentVerificationFailedError,
  createCheckoutSuccess,
} from '../errors';
import type { P24TransactionRegistrationInput } from '../payment-contracts';
import { getCheckoutPaymentProviderAdapter } from './payment-provider';
import { handleCheckoutPaymentStatusNotification } from './payment-status';
import type { StartCheckoutPaymentResult } from './types';

function buildCheckoutPaymentRedirectUrl(args: {
  registrationInput: P24TransactionRegistrationInput;
}): string {
  return args.registrationInput.urlReturn;
}

export async function startCheckoutPayment(args: {
  paymentRegistrationInput: P24TransactionRegistrationInput;
}): Promise<StartCheckoutPaymentResult> {
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
    console.error('Failed to register checkout payment.', error);
    return createCheckoutFailure(
      createCheckoutPaymentRegistrationFailedError(),
    );
  }

  try {
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
