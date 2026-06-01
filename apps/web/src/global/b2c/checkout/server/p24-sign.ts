import { createHash } from 'node:crypto';

import type { P24Currency } from '../payment-contracts';

type JsonPrimitive = string | number | boolean | null;
type JsonRecord = Record<string, JsonPrimitive>;

function createSha384Hex(value: string): string {
  return createHash('sha384').update(value).digest('hex');
}

function stringifyP24SignPayload(payload: JsonRecord): string {
  return JSON.stringify(payload);
}

export function buildP24RegistrationSign(args: {
  sessionId: string;
  merchantId: number;
  amount: number;
  currency: P24Currency;
  crc: string;
}): string {
  return createSha384Hex(
    stringifyP24SignPayload({
      sessionId: args.sessionId,
      merchantId: args.merchantId,
      amount: args.amount,
      currency: args.currency,
      crc: args.crc,
    }),
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
    stringifyP24SignPayload({
      sessionId: args.sessionId,
      orderId: args.orderId,
      amount: args.amount,
      currency: args.currency,
      crc: args.crc,
    }),
  );
}

export function buildP24NotificationSign(args: {
  merchantId: number;
  posId: number;
  sessionId: string;
  amount: number;
  originAmount: number;
  currency: P24Currency;
  orderId: number;
  methodId: number;
  statement: string;
  crc: string;
}): string {
  return createSha384Hex(
    stringifyP24SignPayload({
      merchantId: args.merchantId,
      posId: args.posId,
      sessionId: args.sessionId,
      amount: args.amount,
      originAmount: args.originAmount,
      currency: args.currency,
      orderId: args.orderId,
      methodId: args.methodId,
      statement: args.statement,
      crc: args.crc,
    }),
  );
}
