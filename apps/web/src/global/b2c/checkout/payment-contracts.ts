import type { CheckoutOrderDraft } from './order-draft';

export type CheckoutPaymentProvider = 'przelewy24';

export type P24Currency = 'PLN';

export type P24TransactionRegistrationInput = {
  provider: CheckoutPaymentProvider;
  sessionId: string;
  amountCents: number;
  currency: P24Currency;
  description: string;
  customerEmail: string;
  customerName: string;
  country: string;
  language: 'pl';
  urlReturn: string;
  urlStatus: string;
  orderNumber: string;
  orderId: string;
};

export type P24TransactionRegistrationResult = {
  provider: CheckoutPaymentProvider;
  sessionId: string;
  token: string;
  redirectUrl: string;
  providerReference: string | null;
};

export type P24ReturnStatus =
  | 'success'
  | 'failure'
  | 'cancel'
  | 'pending'
  | 'unknown';

export type P24ReturnState = {
  provider: CheckoutPaymentProvider;
  orderId: string;
  orderNumber: string;
  sessionId: string | null;
  token: string | null;
  status: P24ReturnStatus;
  providerReference: string | null;
};

export type P24StatusNotificationPayload = {
  provider: CheckoutPaymentProvider;
  orderId: string;
  orderNumber: string;
  sessionId: string;
  amountCents: number;
  currency: P24Currency;
  token: string | null;
  providerReference: string | null;
};

export type P24VerificationInput = {
  provider: CheckoutPaymentProvider;
  orderId: string;
  orderNumber: string;
  sessionId: string;
  amountCents: number;
  currency: P24Currency;
  token: string | null;
  providerReference: string | null;
};

export type P24VerificationResult = {
  provider: CheckoutPaymentProvider;
  isVerified: boolean;
  verifiedAt: string | null;
  providerReference: string | null;
};

export function buildP24TransactionRegistrationInput(args: {
  orderId: string;
  orderNumber: string;
  orderDraft: CheckoutOrderDraft;
  urlReturn: string;
  urlStatus: string;
}): P24TransactionRegistrationInput {
  return {
    provider: 'przelewy24',
    sessionId: args.orderNumber,
    amountCents: args.orderDraft.grandTotalCents,
    currency: 'PLN',
    description: `Zamówienie ${args.orderNumber}`,
    customerEmail: args.orderDraft.customerEmail,
    customerName: [
      args.orderDraft.customerSnapshot.firstName,
      args.orderDraft.customerSnapshot.lastName,
    ]
      .filter(Boolean)
      .join(' '),
    country: args.orderDraft.shippingAddressSnapshot.country,
    language: 'pl',
    urlReturn: args.urlReturn,
    urlStatus: args.urlStatus,
    orderNumber: args.orderNumber,
    orderId: args.orderId,
  };
}

export function buildP24VerificationInput(args: {
  orderId: string;
  orderNumber: string;
  orderDraft: CheckoutOrderDraft;
  notification: P24StatusNotificationPayload;
}): P24VerificationInput {
  return {
    provider: 'przelewy24',
    orderId: args.orderId,
    orderNumber: args.orderNumber,
    sessionId: args.notification.sessionId,
    amountCents: args.orderDraft.grandTotalCents,
    currency: 'PLN',
    token: args.notification.token,
    providerReference: args.notification.providerReference,
  };
}
