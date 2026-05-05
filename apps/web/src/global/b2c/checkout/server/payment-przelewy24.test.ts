import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  P24TransactionRegistrationInput,
  P24VerificationInput,
} from '../payment-contracts';
import { P24Client } from './p24-client';
import {
  registerLiveP24Transaction,
  verifyLiveP24Transaction,
} from './payment-przelewy24';

vi.mock('./p24-client', () => ({
  P24Client: vi.fn(function MockP24Client() {
    return {
      registerTransaction: registerTransactionMock,
      verifyTransaction: verifyTransactionMock,
    };
  }),
}));

const registerTransactionMock = vi.fn();
const verifyTransactionMock = vi.fn();

function createRegistrationInput(): P24TransactionRegistrationInput {
  return {
    provider: 'przelewy24',
    checkoutOrderId: 'order-1',
    merchantId: 999999,
    posId: 999999,
    sessionId: 'AF-2026-00001',
    amount: 230_00,
    currency: 'PLN',
    description: 'Zamówienie AF-2026-00001',
    email: 'jan@example.com',
    client: 'Jan Kowalski',
    address: 'Testowa 1',
    zip: '00-001',
    city: 'Warszawa',
    country: 'PL',
    phone: '48123123123',
    language: 'pl',
    urlReturn:
      'https://audiofast-git-b2c-kryptonum.vercel.app/podziekowania-za-zakup/AF-2026-00001/',
    urlStatus:
      'https://audiofast-git-b2c-kryptonum.vercel.app/api/payment/status/',
    timeLimit: 15,
    channel: 1,
    transferLabel: 'AF-2026-00001',
    sign: 'mock-sign',
    cart: [],
    orderNumber: 'AF-2026-00001',
  };
}

function createVerificationInput(): P24VerificationInput {
  return {
    provider: 'przelewy24',
    checkoutOrderId: 'order-1',
    orderNumber: 'AF-2026-00001',
    merchantId: 392337,
    posId: 392337,
    sessionId: 'AF-2026-00001',
    amount: 230_00,
    currency: 'PLN',
    orderId: 123456789,
    sign: 'old-sign',
    paymentId: 'p24:123456789',
  };
}

describe('live Przelewy24 adapter helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('P24_MODE', 'sandbox');
    vi.stubEnv('P24_MERCHANT_ID', '392337');
    vi.stubEnv('P24_POS_ID', '392337');
    vi.stubEnv('P24_API_KEY', 'sandbox-api-key');
    vi.stubEnv('P24_CRC', 'sandbox-crc');
  });

  it('registers a live transaction with config credentials and returns a P24 redirect', async () => {
    registerTransactionMock.mockResolvedValueOnce({
      responseCode: 0,
      data: {
        token: 'real-token',
      },
    });

    const result = await registerLiveP24Transaction(createRegistrationInput());

    expect(registerTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 392337,
        posId: 392337,
        sessionId: 'AF-2026-00001',
        amount: 230_00,
        ttl: 15,
        timeLimit: 15,
        sign: expect.any(String),
      }),
    );
    expect(result).toEqual({
      provider: 'przelewy24',
      merchantId: 392337,
      posId: 392337,
      sessionId: 'AF-2026-00001',
      responseCode: 0,
      token: 'real-token',
      redirectUrl: 'https://sandbox.przelewy24.pl/trnRequest/real-token',
      providerOrderId: null,
      providerReference: null,
    });
  });

  it('verifies a live transaction with a freshly signed payload', async () => {
    verifyTransactionMock.mockResolvedValueOnce({
      responseCode: 0,
      data: {
        status: 'success',
      },
    });

    const result = await verifyLiveP24Transaction(createVerificationInput());

    expect(verifyTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 392337,
        posId: 392337,
        sessionId: 'AF-2026-00001',
        amount: 230_00,
        currency: 'PLN',
        orderId: 123456789,
        sign: expect.any(String),
      }),
    );
    expect(result).toEqual({
      provider: 'przelewy24',
      orderId: 123456789,
      responseCode: 0,
      data: {
        status: 'success',
      },
      isVerified: true,
      verifiedAt: expect.any(String),
      providerReference: 'p24:123456789',
    });
  });
});
