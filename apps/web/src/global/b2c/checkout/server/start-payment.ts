import {
  createCheckoutFailure,
  createCheckoutPaymentRegistrationFailedError,
  createCheckoutPaymentVerificationFailedError,
  createCheckoutSuccess,
} from '../errors';
import type { MockP24ScenarioId } from '../mock-payment-scenarios';
import type {
  P24ReturnState,
  P24TransactionRegistrationInput,
} from '../payment-contracts';
import { getMockP24Scenario } from './payment-mock-scenarios';
import { getCheckoutPaymentProviderAdapter } from './payment-provider';
import { handleCheckoutPaymentStatusNotification } from './payment-status';
import type { StartCheckoutPaymentResult } from './types';

function buildCheckoutPaymentRedirectUrl(args: {
  registrationInput: P24TransactionRegistrationInput;
  returnState: P24ReturnState;
}): string {
  const redirectUrl = new URL(args.registrationInput.urlReturn);
  redirectUrl.searchParams.set('order', args.returnState.orderNumber);

  if (args.returnState.mockScenarioId) {
    redirectUrl.searchParams.set('scenario', args.returnState.mockScenarioId);
  }

  return redirectUrl.toString();
}

function shouldProcessPaymentStatusImmediately(
  scenarioId: MockP24ScenarioId | null | undefined,
): boolean {
  const scenario = getMockP24Scenario(scenarioId ?? undefined);

  return scenario.eventOrder === 'status_before_return';
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
  let returnState: P24ReturnState;
  const providerAdapter = getCheckoutPaymentProviderAdapter(
    args.paymentRegistrationInput.provider,
  );

  try {
    registration = await providerAdapter.registerTransaction(
      args.paymentRegistrationInput,
    );
    returnState = providerAdapter.buildReturnState({
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
    let wasAlreadyPaid = false;

    if (
      shouldProcessPaymentStatusImmediately(
        args.paymentRegistrationInput.mockScenarioId,
      )
    ) {
      const notification = providerAdapter.buildStatusNotificationPayload({
        registrationInput: args.paymentRegistrationInput,
        registrationResult: registration,
      });
      const paymentStatus = await handleCheckoutPaymentStatusNotification({
        notification,
      });

      wasAlreadyPaid = paymentStatus.wasAlreadyPaid;
    }

    return createCheckoutSuccess({
      orderId: args.paymentRegistrationInput.checkoutOrderId,
      orderNumber: args.paymentRegistrationInput.orderNumber,
      redirectUrl: buildCheckoutPaymentRedirectUrl({
        registrationInput: args.paymentRegistrationInput,
        returnState,
      }),
      registration,
      wasAlreadyPaid,
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
