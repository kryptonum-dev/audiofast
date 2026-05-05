import 'server-only';

import type {
  P24Currency,
  P24StatusNotificationPayload,
} from '../payment-contracts';
import { getP24Mode, loadP24Config } from './p24-config';
import { buildP24NotificationSign } from './p24-sign';

type RawP24TransactionResultPayload = {
  merchantId: number;
  posId: number;
  sessionId: string;
  amount: number;
  originAmount: number;
  currency: P24Currency;
  orderId: number;
  methodId: number;
  statement: string;
  sign: string;
};

export class P24NotificationParseError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 = 400,
  ) {
    super(message);
    this.name = 'P24NotificationParseError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInternalStatusNotificationPayload(
  value: unknown,
): value is P24StatusNotificationPayload {
  return (
    isRecord(value) &&
    value.provider === 'przelewy24' &&
    typeof value.orderNumber === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.orderId === 'number' &&
    isRecord(value.result) &&
    typeof value.result.generalStatus === 'string'
  );
}

function readRequiredNumber(
  payload: Record<string, unknown>,
  key: keyof RawP24TransactionResultPayload,
): number {
  const value = payload[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new P24NotificationParseError(
      `P24 notification field ${key} is invalid.`,
    );
  }

  return value;
}

function readRequiredString(
  payload: Record<string, unknown>,
  key: keyof RawP24TransactionResultPayload,
): string {
  const value = payload[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new P24NotificationParseError(
      `P24 notification field ${key} is invalid.`,
    );
  }

  return value;
}

function readCurrency(payload: Record<string, unknown>): P24Currency {
  const currency = readRequiredString(payload, 'currency');

  if (currency !== 'PLN') {
    throw new P24NotificationParseError(
      `Unsupported P24 notification currency ${currency}.`,
    );
  }

  return currency;
}

function parseRawP24TransactionResultPayload(
  payload: unknown,
): RawP24TransactionResultPayload {
  if (!isRecord(payload)) {
    throw new P24NotificationParseError(
      'P24 notification payload must be an object.',
    );
  }

  return {
    merchantId: readRequiredNumber(payload, 'merchantId'),
    posId: readRequiredNumber(payload, 'posId'),
    sessionId: readRequiredString(payload, 'sessionId'),
    amount: readRequiredNumber(payload, 'amount'),
    originAmount: readRequiredNumber(payload, 'originAmount'),
    currency: readCurrency(payload),
    orderId: readRequiredNumber(payload, 'orderId'),
    methodId: readRequiredNumber(payload, 'methodId'),
    statement: readRequiredString(payload, 'statement'),
    sign: readRequiredString(payload, 'sign'),
  };
}

function assertRawP24NotificationAuthenticity(
  payload: RawP24TransactionResultPayload,
): void {
  const config = loadP24Config();

  if (
    payload.merchantId !== config.merchantId ||
    payload.posId !== config.posId
  ) {
    throw new P24NotificationParseError(
      'P24 notification merchantId or posId does not match local config.',
      403,
    );
  }

  const expectedSign = buildP24NotificationSign({
    merchantId: payload.merchantId,
    posId: payload.posId,
    sessionId: payload.sessionId,
    amount: payload.amount,
    originAmount: payload.originAmount,
    currency: payload.currency,
    orderId: payload.orderId,
    methodId: payload.methodId,
    statement: payload.statement,
    crc: config.crc,
  });

  if (payload.sign !== expectedSign) {
    throw new P24NotificationParseError(
      'P24 notification sign is invalid.',
      403,
    );
  }
}

function mapRawP24NotificationPayload(
  payload: RawP24TransactionResultPayload,
): P24StatusNotificationPayload {
  return {
    provider: 'przelewy24',
    checkoutOrderId: '',
    orderNumber: payload.sessionId,
    merchantId: payload.merchantId,
    posId: payload.posId,
    orderId: payload.orderId,
    sessionId: payload.sessionId,
    method: payload.methodId,
    result: {
      generalStatus: 'done',
      detailedStatus: payload.statement,
      paymentId: `p24:${payload.orderId}`,
    },
  };
}

export function parseP24PaymentStatusNotification(
  payload: unknown,
): P24StatusNotificationPayload {
  if (isInternalStatusNotificationPayload(payload) && getP24Mode() === 'mock') {
    return payload;
  }

  const rawPayload = parseRawP24TransactionResultPayload(payload);
  assertRawP24NotificationAuthenticity(rawPayload);

  return mapRawP24NotificationPayload(rawPayload);
}
