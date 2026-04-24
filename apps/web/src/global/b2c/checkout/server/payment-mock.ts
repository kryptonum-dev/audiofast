import type {
  P24ReturnState,
  P24StatusNotificationPayload,
  P24TransactionNotificationStatus,
  P24TransactionRegistrationInput,
  P24TransactionRegistrationResult,
  P24VerificationInput,
  P24VerificationResult,
} from '../payment-contracts';
import { buildP24VerificationInput } from '../payment-contracts';
import type { CheckoutPaymentProviderAdapter } from './payment-provider';

function sanitizeMockSuffix(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function buildMockProviderOrderId(orderNumber: string): number {
  const digits = orderNumber.replace(/\D/g, '');
  return Number(digits.slice(-9) || '1');
}

function buildMockPaymentStatus(): P24TransactionNotificationStatus {
  return 'done';
}

export async function registerMockP24Transaction(
  input: P24TransactionRegistrationInput,
): Promise<P24TransactionRegistrationResult> {
  const suffix = sanitizeMockSuffix(input.orderNumber);

  return {
    provider: 'przelewy24',
    merchantId: input.merchantId,
    posId: input.posId,
    sessionId: input.sessionId,
    responseCode: 0,
    token: `mock-p24-token-${suffix}`,
    redirectUrl: `https://sandbox.przelewy24.pl/trnRequest/mock-p24-token-${suffix}`,
    providerOrderId: buildMockProviderOrderId(input.orderNumber),
    providerReference: null,
  };
}

export function buildMockP24StatusNotificationPayload(args: {
  registrationInput: P24TransactionRegistrationInput;
  registrationResult: P24TransactionRegistrationResult;
}): P24StatusNotificationPayload {
  return {
    provider: 'przelewy24',
    checkoutOrderId: args.registrationInput.checkoutOrderId,
    orderNumber: args.registrationInput.orderNumber,
    merchantId: args.registrationResult.merchantId,
    posId: args.registrationResult.posId,
    orderId: args.registrationResult.providerOrderId,
    sessionId: args.registrationResult.sessionId,
    method: 0,
    result: {
      generalStatus: buildMockPaymentStatus(),
      detailedStatus:
        'Provider notification confirms payment before the browser returns.',
      paymentId: `mock-p24-payment-${sanitizeMockSuffix(
        args.registrationInput.orderNumber,
      )}`,
    },
  };
}

export function buildMockP24ReturnState(args: {
  registrationInput: P24TransactionRegistrationInput;
  registrationResult: P24TransactionRegistrationResult;
}): P24ReturnState {
  return {
    provider: 'przelewy24',
    checkoutOrderId: args.registrationInput.checkoutOrderId,
    orderNumber: args.registrationInput.orderNumber,
    providerOrderId: args.registrationResult.providerOrderId,
    sessionId: args.registrationResult.sessionId,
    token: args.registrationResult.token,
    status: 'success',
    providerReference: `mock-p24-payment-${sanitizeMockSuffix(
      args.registrationInput.orderNumber,
    )}`,
  };
}

export async function verifyMockP24Transaction(
  input: P24VerificationInput,
): Promise<P24VerificationResult> {
  return {
    provider: 'przelewy24',
    orderId: input.orderId,
    responseCode: 0,
    data: {
      status: 'success',
    },
    isVerified: true,
    verifiedAt: new Date().toISOString(),
    providerReference: input.paymentId,
  };
}

export const mockPrzelewy24PaymentProviderAdapter: CheckoutPaymentProviderAdapter =
  {
    provider: 'przelewy24',
    registerTransaction: registerMockP24Transaction,
    buildStatusNotificationPayload: ({
      registrationInput,
      registrationResult,
    }) =>
      buildMockP24StatusNotificationPayload({
        registrationInput,
        registrationResult,
      }),
    buildReturnState: ({ registrationInput, registrationResult }) =>
      buildMockP24ReturnState({
        registrationInput,
        registrationResult,
      }),
    buildVerificationInput: ({ registrationInput, notification }) =>
      buildP24VerificationInput({
        registrationInput,
        notification,
      }),
    verifyTransaction: verifyMockP24Transaction,
  };
