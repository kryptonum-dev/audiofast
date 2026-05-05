import { createHash } from 'node:crypto';

import {
  CHECKOUT_PAYMENT_WINDOW_MINUTES,
  type CheckoutOrderDraft,
} from './order-draft';

export type CheckoutPaymentProvider = 'przelewy24';

export type P24Currency = 'PLN';
export type P24Language = 'pl';

export type P24TransactionRegisterCartItem = {
  sellerId: string;
  sellerCategory: string;
  name: string;
  description: string;
  quantity: number;
  price: number;
  number: string;
};

export type P24TransactionNotificationStatus =
  | 'done'
  | 'pending'
  | 'submitted'
  | 'rejected'
  | 'scheduled'
  | 'cancelled';

export type P24TransactionRegistrationInput = {
  provider: CheckoutPaymentProvider;
  checkoutOrderId: string;
  merchantId: number;
  posId: number;
  sessionId: string;
  amount: number;
  currency: P24Currency;
  description: string;
  email: string;
  client: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  phone: string | null;
  language: P24Language;
  urlReturn: string;
  urlStatus: string;
  timeLimit: number;
  channel: number;
  transferLabel: string;
  sign: string;
  cart: P24TransactionRegisterCartItem[];
  orderNumber: string;
};

export type P24TransactionRegistrationResult = {
  provider: CheckoutPaymentProvider;
  merchantId: number;
  posId: number;
  sessionId: string;
  responseCode: number;
  token: string;
  redirectUrl: string;
  providerOrderId: number | null;
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
  checkoutOrderId: string;
  orderNumber: string;
  providerOrderId: number | null;
  sessionId: string | null;
  token: string | null;
  status: P24ReturnStatus;
  providerReference: string | null;
};

export type P24StatusNotificationResult = {
  generalStatus: P24TransactionNotificationStatus;
  detailedStatus: string;
  paymentId: string;
};

export type P24StatusNotificationPayload = {
  provider: CheckoutPaymentProvider;
  checkoutOrderId: string;
  orderNumber: string;
  merchantId: number;
  posId: number;
  orderId: number;
  sessionId: string;
  method: number;
  result: P24StatusNotificationResult;
};

export type P24VerificationInput = {
  provider: CheckoutPaymentProvider;
  checkoutOrderId: string;
  orderNumber: string;
  merchantId: number;
  posId: number;
  sessionId: string;
  amount: number;
  currency: P24Currency;
  orderId: number;
  sign: string;
  paymentId: string | null;
};

export type P24VerificationStatus = 'success' | 'failure';

export type P24VerificationData = {
  status: P24VerificationStatus;
};

export type P24VerificationResult = {
  provider: CheckoutPaymentProvider;
  orderId: number;
  responseCode: number;
  data: P24VerificationData;
  isVerified: boolean;
  verifiedAt: string | null;
  providerReference: string | null;
};

const MOCK_P24_MERCHANT_ID = 999999;
const MOCK_P24_POS_ID = 999999;
const MOCK_P24_CRC = 'mock-p24-crc';
const DEFAULT_P24_CHANNEL = 8194;

function createSha384Hex(value: string): string {
  return createHash('sha384').update(value).digest('hex');
}

function buildP24RegistrationSign(args: {
  sessionId: string;
  merchantId: number;
  amount: number;
  currency: P24Currency;
  crc: string;
}): string {
  return createSha384Hex(
    `${args.sessionId}${args.merchantId}${args.amount}${args.currency}${args.crc}`,
  );
}

export function buildP24VerificationSign(args: {
  sessionId: string;
  orderId: number;
  amount: number;
  currency: P24Currency;
  crc: string;
}): string {
  return createSha384Hex(
    JSON.stringify({
      sessionId: args.sessionId,
      orderId: args.orderId,
      amount: args.amount,
      currency: args.currency,
      crc: args.crc,
    }),
  );
}

function buildP24ClientName(orderDraft: CheckoutOrderDraft): string {
  return [
    orderDraft.customerSnapshot.firstName,
    orderDraft.customerSnapshot.lastName,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildP24StreetAddress(orderDraft: CheckoutOrderDraft): string {
  return [
    orderDraft.shippingAddressSnapshot.streetName,
    orderDraft.shippingAddressSnapshot.buildingNumber,
    orderDraft.shippingAddressSnapshot.apartmentNumber,
  ]
    .filter(Boolean)
    .join(' ');
}

function normalizePolishPhoneForP24(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  const digits = raw.replace(/\D/g, '');

  if (digits.startsWith('48')) {
    return digits;
  }

  if (digits.length === 9) {
    return `48${digits}`;
  }

  return digits;
}

function buildP24CartItems(
  orderDraft: CheckoutOrderDraft,
): P24TransactionRegisterCartItem[] {
  return orderDraft.items.map((item) => ({
    sellerId: item.brandName,
    sellerCategory: item.productKey,
    name: item.productName,
    description: `${item.brandName} / ${item.productKey}`,
    quantity: item.quantity,
    price: item.unitPriceCents,
    number: item.productId,
  }));
}

export function buildP24TransactionRegistrationInput(args: {
  orderId: string;
  orderNumber: string;
  orderDraft: CheckoutOrderDraft;
  urlReturn: string;
  urlStatus: string;
}): P24TransactionRegistrationInput {
  const merchantId = MOCK_P24_MERCHANT_ID;
  const posId = MOCK_P24_POS_ID;
  const sessionId = args.orderNumber;
  const amount = args.orderDraft.grandTotalCents;
  const currency: P24Currency = 'PLN';

  return {
    provider: 'przelewy24',
    checkoutOrderId: args.orderId,
    merchantId,
    posId,
    sessionId,
    amount,
    currency,
    description: `Zamówienie ${args.orderNumber}`,
    email: args.orderDraft.customerEmail,
    client: buildP24ClientName(args.orderDraft),
    address: buildP24StreetAddress(args.orderDraft),
    zip: args.orderDraft.shippingAddressSnapshot.postalCode,
    city: args.orderDraft.shippingAddressSnapshot.city,
    country: args.orderDraft.shippingAddressSnapshot.country,
    phone: normalizePolishPhoneForP24(
      args.orderDraft.shippingAddressSnapshot.phone,
    ),
    language: 'pl',
    urlReturn: args.urlReturn,
    urlStatus: args.urlStatus,
    timeLimit: CHECKOUT_PAYMENT_WINDOW_MINUTES,
    channel: DEFAULT_P24_CHANNEL,
    transferLabel: args.orderNumber.slice(0, 20),
    sign: buildP24RegistrationSign({
      sessionId,
      merchantId,
      amount,
      currency,
      crc: MOCK_P24_CRC,
    }),
    cart: buildP24CartItems(args.orderDraft),
    orderNumber: args.orderNumber,
  };
}

export function buildP24VerificationInput(args: {
  registrationInput: P24TransactionRegistrationInput;
  notification: P24StatusNotificationPayload;
}): P24VerificationInput {
  return {
    provider: 'przelewy24',
    checkoutOrderId: args.registrationInput.checkoutOrderId,
    orderNumber: args.registrationInput.orderNumber,
    merchantId: args.registrationInput.merchantId,
    posId: args.registrationInput.posId,
    sessionId: args.notification.sessionId,
    amount: args.registrationInput.amount,
    currency: args.registrationInput.currency,
    orderId: args.notification.orderId,
    sign: buildP24VerificationSign({
      sessionId: args.notification.sessionId,
      orderId: args.notification.orderId,
      amount: args.registrationInput.amount,
      currency: args.registrationInput.currency,
      crc: MOCK_P24_CRC,
    }),
    paymentId: args.notification.result.paymentId,
  };
}
