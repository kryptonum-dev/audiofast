import { describe, expect, it } from 'vitest';

import type { P24TransactionRegistrationInput } from '../payment-contracts';
import { getCheckoutPaymentProviderAdapter } from './payment-provider';

function createPaymentRegistrationInput(
  overrides: Partial<P24TransactionRegistrationInput> = {},
): P24TransactionRegistrationInput {
  return {
    provider: 'przelewy24',
    checkoutOrderId: 'order-1',
    merchantId: 999999,
    posId: 999999,
    sessionId: 'AF-2026-00001',
    amount: 230_00,
    currency: 'PLN',
    description: 'Zamowienie AF-2026-00001',
    email: 'jan@example.com',
    client: 'Jan Kowalski',
    address: 'Testowa 1',
    zip: '00-001',
    city: 'Warszawa',
    country: 'PL',
    phone: '48123123123',
    language: 'pl',
    urlReturn: 'http://localhost:3000/podziekowania-za-zakup/',
    urlStatus: 'http://localhost:3000/api/payment/status/',
    timeLimit: 15,
    channel: 1,
    transferLabel: 'AF-2026-00001',
    sign: 'mock-registration-sign',
    cart: [
      {
        sellerId: 'Test brand',
        sellerCategory: '/produkty/test/',
        name: 'Test product',
        description: 'Test brand / /produkty/test/',
        quantity: 1,
        price: 230_00,
        number: 'product-1',
      },
    ],
    orderNumber: 'AF-2026-00001',
    ...overrides,
  };
}

describe('getCheckoutPaymentProviderAdapter', () => {
  it('returns the przelewy24 adapter with the expected mock registration data', async () => {
    const adapter = getCheckoutPaymentProviderAdapter('przelewy24');
    const registrationInput = createPaymentRegistrationInput();

    const registration = await adapter.registerTransaction(registrationInput);

    expect(adapter.provider).toBe('przelewy24');
    expect(registration).toEqual({
      provider: 'przelewy24',
      merchantId: 999999,
      posId: 999999,
      sessionId: 'AF-2026-00001',
      responseCode: 0,
      token: 'mock-p24-token-af202600001',
      redirectUrl:
        'https://sandbox.przelewy24.pl/trnRequest/mock-p24-token-af202600001',
      providerOrderId: 202600001,
      providerReference: null,
    });
  });

  it('builds mock notification and verification payloads from the provider contract', async () => {
    const adapter = getCheckoutPaymentProviderAdapter('przelewy24');
    const registrationInput = createPaymentRegistrationInput();
    const registration = await adapter.registerTransaction(registrationInput);
    const returnState = adapter.buildReturnState({
      registrationInput,
      registrationResult: registration,
    });

    const notification = adapter.buildStatusNotificationPayload({
      registrationInput,
      registrationResult: registration,
    });
    const verificationInput = adapter.buildVerificationInput({
      registrationInput,
      notification,
    });
    const verification = await adapter.verifyTransaction(verificationInput);

    expect(returnState).toEqual({
      provider: 'przelewy24',
      checkoutOrderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      providerOrderId: 202600001,
      sessionId: 'AF-2026-00001',
      token: 'mock-p24-token-af202600001',
      status: 'success',
      providerReference: 'mock-p24-payment-af202600001',
    });
    expect(notification).toEqual({
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
        detailedStatus:
          'Provider notification confirms payment before the browser returns.',
        paymentId: 'mock-p24-payment-af202600001',
      },
    });
    expect(verificationInput).toEqual(
      expect.objectContaining({
        provider: 'przelewy24',
        checkoutOrderId: 'order-1',
        orderNumber: 'AF-2026-00001',
        merchantId: 999999,
        posId: 999999,
        sessionId: 'AF-2026-00001',
        amount: 230_00,
        currency: 'PLN',
        orderId: 202600001,
        paymentId: 'mock-p24-payment-af202600001',
      }),
    );
    expect(verificationInput.sign).toEqual(expect.any(String));
    expect(verification.provider).toBe('przelewy24');
    expect(verification.orderId).toBe(202600001);
    expect(verification.responseCode).toBe(0);
    expect(verification.data.status).toBe('success');
    expect(verification.isVerified).toBe(true);
    expect(verification.providerReference).toBe('mock-p24-payment-af202600001');
    expect(verification.verifiedAt).toEqual(expect.any(String));
  });
});
