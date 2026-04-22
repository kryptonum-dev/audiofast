import type {
  CheckoutPaymentProvider,
  P24ReturnState,
  P24StatusNotificationPayload,
  P24TransactionRegistrationInput,
  P24TransactionRegistrationResult,
  P24VerificationInput,
  P24VerificationResult,
} from '../payment-contracts';
import { mockPrzelewy24PaymentProviderAdapter } from './payment-mock';

export type CheckoutPaymentProviderAdapter = {
  provider: CheckoutPaymentProvider;
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

const checkoutPaymentProviderRegistry: Record<
  CheckoutPaymentProvider,
  CheckoutPaymentProviderAdapter
> = {
  przelewy24: mockPrzelewy24PaymentProviderAdapter,
};

export function getCheckoutPaymentProviderAdapter(
  provider: CheckoutPaymentProvider,
): CheckoutPaymentProviderAdapter {
  return checkoutPaymentProviderRegistry[provider];
}
