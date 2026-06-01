import type {
  CheckoutPaymentProvider,
  P24ReturnState,
  P24StatusNotificationPayload,
  P24TransactionRegistrationInput,
  P24TransactionRegistrationResult,
  P24VerificationInput,
  P24VerificationResult,
} from '../payment-contracts';
import { isP24LiveMode } from './p24-config';
import { mockPrzelewy24PaymentProviderAdapter } from './payment-mock';
import { livePrzelewy24PaymentProviderAdapter } from './payment-przelewy24';

export type CheckoutPaymentProviderAdapter = {
  provider: CheckoutPaymentProvider;
  autoConfirmPaymentOnStart: boolean;
  registerTransaction(
    input: P24TransactionRegistrationInput,
  ): Promise<P24TransactionRegistrationResult>;
  buildStatusNotificationPayload(args: {
    registrationInput: P24TransactionRegistrationInput;
    registrationResult: P24TransactionRegistrationResult;
  }): P24StatusNotificationPayload;
  buildReturnState(args: {
    registrationInput: P24TransactionRegistrationInput;
    registrationResult: P24TransactionRegistrationResult;
  }): P24ReturnState;
  buildVerificationInput(args: {
    registrationInput: P24TransactionRegistrationInput;
    notification: P24StatusNotificationPayload;
  }): P24VerificationInput;
  verifyTransaction(
    input: P24VerificationInput,
  ): Promise<P24VerificationResult>;
};

export function getCheckoutPaymentProviderAdapter(
  provider: CheckoutPaymentProvider,
): CheckoutPaymentProviderAdapter {
  if (provider === 'przelewy24') {
    return isP24LiveMode()
      ? livePrzelewy24PaymentProviderAdapter
      : mockPrzelewy24PaymentProviderAdapter;
  }

  throw new Error(`Unsupported checkout payment provider: ${provider}`);
}
