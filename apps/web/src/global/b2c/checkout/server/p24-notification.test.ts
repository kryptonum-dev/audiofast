import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseP24PaymentStatusNotification } from './p24-notification';
import { buildP24NotificationSign } from './p24-sign';

function stubSandboxEnv() {
  vi.stubEnv('P24_MODE', 'sandbox');
  vi.stubEnv('P24_MERCHANT_ID', '392337');
  vi.stubEnv('P24_POS_ID', '392337');
  vi.stubEnv('P24_API_KEY', 'sandbox-api-key');
  vi.stubEnv('P24_CRC', 'sandbox-crc');
}

function createRawNotification(overrides: Record<string, unknown> = {}) {
  const payload = {
    merchantId: 392337,
    posId: 392337,
    sessionId: 'AF-2026-00001',
    amount: 230_00,
    originAmount: 230_00,
    currency: 'PLN',
    orderId: 123456789,
    methodId: 241,
    statement: 'AF-2026-00001',
    ...overrides,
  };

  return {
    ...payload,
    sign: buildP24NotificationSign({
      merchantId: payload.merchantId as number,
      posId: payload.posId as number,
      sessionId: payload.sessionId as string,
      amount: payload.amount as number,
      originAmount: payload.originAmount as number,
      currency: 'PLN',
      orderId: payload.orderId as number,
      methodId: payload.methodId as number,
      statement: payload.statement as string,
      crc: 'sandbox-crc',
    }),
  };
}

describe('parseP24PaymentStatusNotification', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts the internal mock payload in mock mode', () => {
    vi.stubEnv('P24_FORCE_MOCK', '1');

    expect(
      parseP24PaymentStatusNotification({
        provider: 'przelewy24',
        checkoutOrderId: 'order-1',
        orderNumber: 'AF-2026-00001',
        merchantId: 999999,
        posId: 999999,
        orderId: 202600001,
        sessionId: 'AF-2026-00001',
        method: 0,
        result: {
          generalStatus: 'done',
          detailedStatus: 'Mock payment confirmed.',
          paymentId: 'mock-payment',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        orderNumber: 'AF-2026-00001',
        result: expect.objectContaining({
          generalStatus: 'done',
        }),
      }),
    );
  });

  it('normalizes a signed raw P24 transaction result notification', () => {
    stubSandboxEnv();

    expect(parseP24PaymentStatusNotification(createRawNotification())).toEqual({
      provider: 'przelewy24',
      checkoutOrderId: '',
      orderNumber: 'AF-2026-00001',
      merchantId: 392337,
      posId: 392337,
      orderId: 123456789,
      sessionId: 'AF-2026-00001',
      method: 241,
      result: {
        generalStatus: 'done',
        detailedStatus: 'AF-2026-00001',
        paymentId: 'p24:123456789',
      },
    });
  });

  it('rejects merchant mismatches', () => {
    stubSandboxEnv();

    expect(() =>
      parseP24PaymentStatusNotification(
        createRawNotification({
          merchantId: 123,
        }),
      ),
    ).toThrow(/merchantId or posId/);
  });

  it('rejects invalid signs', () => {
    stubSandboxEnv();

    expect(() =>
      parseP24PaymentStatusNotification({
        ...createRawNotification(),
        sign: 'invalid-sign',
      }),
    ).toThrow(/sign is invalid/);
  });
});
