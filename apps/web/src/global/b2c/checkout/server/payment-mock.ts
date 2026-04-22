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
import {
  DEFAULT_MOCK_P24_SCENARIO_ID,
  getMockP24Scenario,
  type MockP24ScenarioId,
} from './payment-mock-scenarios';
import type { CheckoutPaymentProviderAdapter } from './payment-provider';

function sanitizeMockSuffix(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function buildMockProviderOrderId(orderNumber: string): number {
  const digits = orderNumber.replace(/\D/g, '');
  return Number(digits.slice(-9) || '1');
}

function buildMockPaymentStatus(
  scenarioId: MockP24ScenarioId,
): P24TransactionNotificationStatus {
  const scenario = getMockP24Scenario(scenarioId);

  if (scenario.providerNotificationStatus === null) {
    throw new Error(
      `Mock Przelewy24 scenario ${scenarioId} does not emit a status notification.`,
    );
  }

  return scenario.providerNotificationStatus;
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
  scenarioId?: MockP24ScenarioId;
}): P24StatusNotificationPayload {
  const scenarioId =
    args.scenarioId ??
    args.registrationInput.mockScenarioId ??
    DEFAULT_MOCK_P24_SCENARIO_ID;
  const scenario = getMockP24Scenario(scenarioId);

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
      generalStatus: buildMockPaymentStatus(scenarioId),
      detailedStatus: scenario.description,
      paymentId: `mock-p24-payment-${sanitizeMockSuffix(
        args.registrationInput.orderNumber,
      )}`,
    },
  };
}

export function buildMockP24ReturnState(args: {
  registrationInput: P24TransactionRegistrationInput;
  registrationResult: P24TransactionRegistrationResult;
  scenarioId?: MockP24ScenarioId;
}): P24ReturnState {
  const scenarioId =
    args.scenarioId ??
    args.registrationInput.mockScenarioId ??
    DEFAULT_MOCK_P24_SCENARIO_ID;
  const scenario = getMockP24Scenario(scenarioId);

  return {
    provider: 'przelewy24',
    mockScenarioId: args.registrationInput.mockScenarioId ?? null,
    checkoutOrderId: args.registrationInput.checkoutOrderId,
    orderNumber: args.registrationInput.orderNumber,
    providerOrderId: args.registrationResult.providerOrderId,
    sessionId: args.registrationResult.sessionId,
    token: args.registrationResult.token,
    status: scenario.returnStatus,
    providerReference:
      scenario.providerNotificationStatus === 'done'
        ? `mock-p24-payment-${sanitizeMockSuffix(
            args.registrationInput.orderNumber,
          )}`
        : null,
  };
}

export function buildMockP24StatusNotificationPayloadForOrder(args: {
  checkoutOrderId: string;
  orderNumber: string;
  scenarioId?: MockP24ScenarioId | null;
}): P24StatusNotificationPayload | null {
  const scenarioId = args.scenarioId ?? DEFAULT_MOCK_P24_SCENARIO_ID;
  const scenario = getMockP24Scenario(scenarioId);

  if (scenario.providerNotificationStatus === null) {
    return null;
  }

  const providerOrderId = buildMockProviderOrderId(args.orderNumber);
  const sessionId = args.orderNumber;

  return {
    provider: 'przelewy24',
    checkoutOrderId: args.checkoutOrderId,
    orderNumber: args.orderNumber,
    merchantId: 999999,
    posId: 999999,
    orderId: providerOrderId,
    sessionId,
    method: 0,
    result: {
      generalStatus: scenario.providerNotificationStatus,
      detailedStatus: scenario.description,
      paymentId: `mock-p24-payment-${sanitizeMockSuffix(args.orderNumber)}`,
    },
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
