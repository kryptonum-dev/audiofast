import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { P24TransactionRegistrationInput } from '../payment-contracts';
import type { CheckoutPaymentProviderAdapter } from './payment-provider';
import { getCheckoutPaymentProviderAdapter } from './payment-provider';
import { handleCheckoutPaymentStatusNotification } from './payment-status';
import { startCheckoutPayment } from './start-payment';

vi.mock('./payment-provider', () => ({
  getCheckoutPaymentProviderAdapter: vi.fn(),
}));

vi.mock('./payment-status', () => ({
  handleCheckoutPaymentStatusNotification: vi.fn(),
}));

function createPaymentRegistrationInput(): P24TransactionRegistrationInput {
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
    urlReturn: 'http://localhost:3000/podziekowania-za-zakup/AF-2026-00001/',
    urlStatus: 'http://localhost:3000/api/payment/status/',
    timeLimit: 15,
    channel: 8194,
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
  };
}

describe('startCheckoutPayment', () => {
  const providerAdapter: CheckoutPaymentProviderAdapter = {
    provider: 'przelewy24',
    autoConfirmPaymentOnStart: true,
    registerTransaction: vi.fn(),
    buildStatusNotificationPayload: vi.fn(),
    buildReturnState: vi.fn(),
    buildVerificationInput: vi.fn(),
    verifyTransaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    providerAdapter.autoConfirmPaymentOnStart = true;

    vi.mocked(getCheckoutPaymentProviderAdapter).mockReturnValue(
      providerAdapter,
    );
    vi.mocked(providerAdapter.registerTransaction).mockResolvedValue({
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
    vi.mocked(providerAdapter.buildStatusNotificationPayload).mockReturnValue({
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
        detailedStatus: 'Transaction completed in local Przelewy24 mock.',
        paymentId: 'mock-p24-payment-af202600001',
      },
    });
    vi.mocked(providerAdapter.buildReturnState).mockReturnValue({
      provider: 'przelewy24',
      checkoutOrderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      providerOrderId: 202600001,
      sessionId: 'AF-2026-00001',
      token: 'mock-p24-token-af202600001',
      status: 'success',
      providerReference: 'mock-p24-payment-af202600001',
    });
    vi.mocked(handleCheckoutPaymentStatusNotification).mockResolvedValue({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      providerStatus: 'done',
      currentStatus: 'awaiting_confirmation',
      wasConfirmed: true,
      wasAlreadyPaid: false,
    });
  });

  it('registers the mock payment, confirms the order, and returns the thank-you redirect', async () => {
    const result = await startCheckoutPayment({
      paymentRegistrationInput: createPaymentRegistrationInput(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(getCheckoutPaymentProviderAdapter).toHaveBeenCalledWith(
      'przelewy24',
    );
    expect(providerAdapter.registerTransaction).toHaveBeenCalledWith(
      createPaymentRegistrationInput(),
    );
    expect(providerAdapter.buildStatusNotificationPayload).toHaveBeenCalledWith(
      {
        registrationInput: createPaymentRegistrationInput(),
        registrationResult: {
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
        },
      },
    );
    expect(providerAdapter.buildReturnState).toHaveBeenCalledWith({
      registrationInput: createPaymentRegistrationInput(),
      registrationResult: {
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
      },
    });
    expect(handleCheckoutPaymentStatusNotification).toHaveBeenCalledWith({
      notification: {
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
          detailedStatus: 'Transaction completed in local Przelewy24 mock.',
          paymentId: 'mock-p24-payment-af202600001',
        },
      },
    });
    expect(result.value.redirectUrl).toBe(
      'http://localhost:3000/podziekowania-za-zakup/AF-2026-00001/',
    );
  });

  it('returns payment_registration_failed when registration throws', async () => {
    vi.mocked(providerAdapter.registerTransaction).mockRejectedValueOnce(
      new Error('boom'),
    );

    const result = await startCheckoutPayment({
      paymentRegistrationInput: createPaymentRegistrationInput(),
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe(
      'payment_registration_failed',
    );
    expect(handleCheckoutPaymentStatusNotification).not.toHaveBeenCalled();
  });

  it('blocks provider registration when the online payment amount is too high', async () => {
    const result = await startCheckoutPayment({
      paymentRegistrationInput: {
        ...createPaymentRegistrationInput(),
        amount: 50_001_00,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe(
      'payment_amount_too_high',
    );
    expect(getCheckoutPaymentProviderAdapter).not.toHaveBeenCalled();
    expect(providerAdapter.registerTransaction).not.toHaveBeenCalled();
  });

  it('returns payment_verification_failed when status processing throws', async () => {
    vi.mocked(handleCheckoutPaymentStatusNotification).mockRejectedValueOnce(
      new Error('boom'),
    );

    const result = await startCheckoutPayment({
      paymentRegistrationInput: createPaymentRegistrationInput(),
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe(
      'payment_verification_failed',
    );
  });

  it('returns the provider redirect without confirming payment when the adapter is live', async () => {
    providerAdapter.autoConfirmPaymentOnStart = false;

    const result = await startCheckoutPayment({
      paymentRegistrationInput: createPaymentRegistrationInput(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(
      providerAdapter.buildStatusNotificationPayload,
    ).not.toHaveBeenCalled();
    expect(handleCheckoutPaymentStatusNotification).not.toHaveBeenCalled();
    expect(result.value.redirectUrl).toBe(
      'https://sandbox.przelewy24.pl/trnRequest/mock-p24-token-af202600001',
    );
    expect(result.value.wasAlreadyPaid).toBe(false);
  });
});
