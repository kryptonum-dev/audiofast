import type {
  P24ReturnState,
  P24StatusNotificationPayload,
  P24TransactionRegistrationInput,
  P24TransactionRegistrationResult,
  P24VerificationInput,
  P24VerificationResult,
} from '../payment-contracts';
import type { CheckoutPaymentProviderAdapter } from './payment-provider';
import { P24Client } from './p24-client';
import { loadP24Config } from './p24-config';
import { buildP24RegistrationSign, buildP24VerificationSign } from './p24-sign';

function buildP24TransactionRequest(
  input: P24TransactionRegistrationInput,
): Parameters<P24Client['registerTransaction']>[0] {
  const config = loadP24Config();
  const sign = buildP24RegistrationSign({
    sessionId: input.sessionId,
    merchantId: config.merchantId,
    amount: input.amount,
    currency: input.currency,
    crc: config.crc,
  });

  return {
    merchantId: config.merchantId,
    posId: config.posId,
    sessionId: input.sessionId,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    email: input.email,
    client: input.client,
    address: input.address,
    zip: input.zip,
    city: input.city,
    country: input.country,
    phone: input.phone,
    language: input.language,
    urlReturn: input.urlReturn,
    urlStatus: input.urlStatus,
    timeLimit: input.timeLimit,
    ttl: input.timeLimit,
    channel: input.channel,
    transferLabel: input.transferLabel,
    sign,
  };
}

export async function registerLiveP24Transaction(
  input: P24TransactionRegistrationInput,
): Promise<P24TransactionRegistrationResult> {
  const config = loadP24Config();
  const client = new P24Client(config);
  const request = buildP24TransactionRequest(input);
  const response = await client.registerTransaction(request);

  return {
    provider: 'przelewy24',
    merchantId: config.merchantId,
    posId: config.posId,
    sessionId: input.sessionId,
    responseCode: response.responseCode,
    token: response.data.token,
    redirectUrl: `${config.redirectBaseUrl}/trnRequest/${encodeURIComponent(
      response.data.token,
    )}`,
    providerOrderId: null,
    providerReference: null,
  };
}

export function buildLiveP24ReturnState(args: {
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
    status: 'pending',
    providerReference: args.registrationResult.providerReference,
  };
}

export function buildLiveP24StatusNotificationPayload(): P24StatusNotificationPayload {
  throw new Error(
    'Live Przelewy24 status notifications must come from the provider callback.',
  );
}

export function buildLiveP24VerificationInput(args: {
  registrationInput: P24TransactionRegistrationInput;
  notification: P24StatusNotificationPayload;
}): P24VerificationInput {
  const config = loadP24Config();

  return {
    provider: 'przelewy24',
    checkoutOrderId: args.registrationInput.checkoutOrderId,
    orderNumber: args.registrationInput.orderNumber,
    merchantId: config.merchantId,
    posId: config.posId,
    sessionId: args.notification.sessionId,
    amount: args.registrationInput.amount,
    currency: args.registrationInput.currency,
    orderId: args.notification.orderId,
    sign: buildP24VerificationSign({
      sessionId: args.notification.sessionId,
      orderId: args.notification.orderId,
      amount: args.registrationInput.amount,
      currency: args.registrationInput.currency,
      crc: config.crc,
    }),
    paymentId: args.notification.result.paymentId,
  };
}

export async function verifyLiveP24Transaction(
  input: P24VerificationInput,
): Promise<P24VerificationResult> {
  const config = loadP24Config();
  const client = new P24Client(config);
  const sign = buildP24VerificationSign({
    sessionId: input.sessionId,
    orderId: input.orderId,
    amount: input.amount,
    currency: input.currency,
    crc: config.crc,
  });
  const response = await client.verifyTransaction({
    merchantId: config.merchantId,
    posId: config.posId,
    sessionId: input.sessionId,
    amount: input.amount,
    currency: input.currency,
    orderId: input.orderId,
    sign,
  });

  return {
    provider: 'przelewy24',
    orderId: input.orderId,
    responseCode: response.responseCode,
    data: {
      status: 'success',
    },
    isVerified: response.responseCode === 0,
    verifiedAt: response.responseCode === 0 ? new Date().toISOString() : null,
    providerReference: input.paymentId ?? `p24:${input.orderId}`,
  };
}

export const livePrzelewy24PaymentProviderAdapter: CheckoutPaymentProviderAdapter =
  {
    provider: 'przelewy24',
    autoConfirmPaymentOnStart: false,
    registerTransaction: registerLiveP24Transaction,
    buildStatusNotificationPayload: buildLiveP24StatusNotificationPayload,
    buildReturnState: buildLiveP24ReturnState,
    buildVerificationInput: buildLiveP24VerificationInput,
    verifyTransaction: verifyLiveP24Transaction,
  };
