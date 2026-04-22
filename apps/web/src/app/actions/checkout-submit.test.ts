import { beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidateCartLines } from '@/src/global/b2c/cart/server/revalidation';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import type { CartState } from '@/src/global/b2c/cart/types';
import { loadCheckoutAuthContext } from '@/src/global/b2c/checkout/server/auth-context';
import { generateNextCheckoutOrderNumber } from '@/src/global/b2c/checkout/server/order-number';
import {
  CheckoutPersistenceError,
  persistCheckoutOrder,
} from '@/src/global/b2c/checkout/server/persistence';
import { startCheckoutPayment } from '@/src/global/b2c/checkout/server/start-payment';
import type { CheckoutSubmitInput } from '@/src/global/b2c/checkout/types';
import { subscribeToNewsletter } from '@/src/global/mailchimp/subscribe';

import { submitCheckout } from './checkout-submit';

vi.mock('@/src/global/b2c/checkout/server/auth-context', () => ({
  loadCheckoutAuthContext: vi.fn(),
}));

vi.mock('@/src/global/b2c/checkout/server/order-number', () => ({
  generateNextCheckoutOrderNumber: vi.fn(),
}));

vi.mock('@/src/global/b2c/checkout/server/persistence', async () => {
  const actual = await vi.importActual(
    '@/src/global/b2c/checkout/server/persistence',
  );

  return {
    ...actual,
    persistCheckoutOrder: vi.fn(),
  };
});

vi.mock('@/src/global/b2c/cart/server/revalidation', () => ({
  revalidateCartLines: vi.fn(),
}));

vi.mock('@/src/global/mailchimp/subscribe', () => ({
  subscribeToNewsletter: vi.fn(),
}));

vi.mock('@/src/global/b2c/checkout/server/start-payment', () => ({
  startCheckoutPayment: vi.fn(),
}));

function createValidCart(): CartState {
  return {
    version: 1,
    lines: [
      createStandardCartLine({
        lineId: 'line-1',
        productId: 'product-1',
        productKey: '/produkty/test/',
        productName: 'Test product',
        brandName: 'Test brand',
        quantity: 1,
        unitPriceCents: 150_00,
        isReturnable: true,
        configurationSelection: {
          variantId: 'variant-1',
          selectedOptions: {
            model: 'value-1',
          },
        },
        configurationSummary: [{ label: 'Model', value: 'Reference' }],
        product: {
          id: 'product-1',
          name: 'Test product',
          brandName: 'Test brand',
          kind: 'standard',
          image: { id: 'image-1' },
          basePrice: 150_00,
          configurationOptions: [],
          totalPrice: 150_00,
        },
      }),
    ],
    coupon: null,
  };
}

function createValidInput(): CheckoutSubmitInput {
  return {
    contact: {
      email: 'jan@example.com',
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123123123',
    },
    shippingAddress: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123123123',
      streetName: 'Testowa',
      buildingNumber: '1',
      apartmentNumber: null,
      postalCode: '00-001',
      city: 'Warszawa',
      country: 'PL',
    },
    invoice: {
      recipientType: 'private',
      companyName: null,
      taxId: null,
      invoiceAddress: null,
    },
    consents: {
      termsAccepted: true,
      privacyPolicyAccepted: true,
    },
    newsletterOptIn: false,
    saveToProfile: false,
    mockPaymentScenarioId: null,
  };
}

describe('submitCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(loadCheckoutAuthContext).mockResolvedValue({
      sessionContext: {
        isAuthenticated: false,
        authUserId: null,
        authenticatedEmail: null,
        customerProfileId: null,
      },
      customerProfile: null,
      canPrefillFromProfile: false,
      isEmailLocked: false,
    });
    vi.mocked(subscribeToNewsletter).mockResolvedValue({
      success: true,
      needsConfirmation: true,
      message: 'Please check your email to confirm subscription',
    });
    vi.mocked(startCheckoutPayment).mockImplementation(
      async ({ paymentRegistrationInput }) => ({
        ok: true,
        value: {
          orderId: paymentRegistrationInput.checkoutOrderId,
          orderNumber: paymentRegistrationInput.orderNumber,
          redirectUrl: `${paymentRegistrationInput.urlReturn}?order=${paymentRegistrationInput.orderNumber}`,
          registration: {
            provider: 'przelewy24',
            merchantId: paymentRegistrationInput.merchantId,
            posId: paymentRegistrationInput.posId,
            sessionId: paymentRegistrationInput.sessionId,
            responseCode: 0,
            token: `mock-p24-token-${paymentRegistrationInput.orderNumber}`,
            redirectUrl: `https://sandbox.przelewy24.pl/trnRequest/mock-p24-token-${paymentRegistrationInput.orderNumber}`,
            providerOrderId: Number(
              paymentRegistrationInput.orderNumber.replace(/\D/g, '').slice(-9),
            ),
            providerReference: null,
          },
          wasAlreadyPaid: false,
        },
      }),
    );
  });

  it('returns a form_invalid failure when the submitted checkout data is invalid', async () => {
    const cart = createValidCart();

    vi.mocked(revalidateCartLines).mockResolvedValue([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 150_00,
      },
    ]);

    const result = await submitCheckout(
      {
        ...createValidInput(),
        contact: {
          ...createValidInput().contact,
          email: '',
        },
        consents: {
          termsAccepted: false,
          privacyPolicyAccepted: false,
        },
      },
      cart,
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe('form_invalid');
    expect(generateNextCheckoutOrderNumber).not.toHaveBeenCalled();
    expect(persistCheckoutOrder).not.toHaveBeenCalled();
    expect(startCheckoutPayment).not.toHaveBeenCalled();
  });

  it('returns a cart_price_updated failure when only unit prices drifted during submit', async () => {
    const cart = createValidCart();

    vi.mocked(revalidateCartLines).mockResolvedValue([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 199_00,
      },
    ]);

    const result = await submitCheckout(createValidInput(), cart);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe('cart_price_updated');
    expect(
      result.ok ? null : result.revalidatedCart?.lines[0]?.unitPriceCents,
    ).toBe(199_00);
    expect(result.ok ? null : result.revalidationResults).toHaveLength(1);
    expect(persistCheckoutOrder).not.toHaveBeenCalled();
    expect(startCheckoutPayment).not.toHaveBeenCalled();
  });

  it('accepts a resubmit with a lingering client-side price_changed issue once the price matches the refreshed one', async () => {
    // Simulate the client state right after a soft failure: the reducer has
    // already applied the revalidation results, so the line now carries a
    // managed `price_changed` issue AND the refreshed unit price. The next
    // submit must succeed (not loop on another cart_price_updated).
    const cart = createValidCart();
    const firstLine = cart.lines[0]!;
    (firstLine as { unitPriceCents: number }).unitPriceCents = 199_00;
    firstLine.issues = [
      {
        code: 'price_changed',
        blocking: false,
        message: 'Cena produktu została zaktualizowana.',
      },
    ];

    vi.mocked(revalidateCartLines).mockResolvedValue([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 199_00,
      },
    ]);
    vi.mocked(generateNextCheckoutOrderNumber).mockResolvedValue(
      'AF-2026-00010',
    );
    vi.mocked(persistCheckoutOrder).mockImplementation(async (args) => ({
      orderId: 'order-10',
      orderNumber: args.orderNumber,
      createdAt: '2026-04-20T10:10:00.000Z',
      orderDraft: args.orderDraft,
      insertedItemCount: args.orderDraft.items.length,
    }));

    const result = await submitCheckout(createValidInput(), cart);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.orderNumber : null).toBe('AF-2026-00010');
    expect(startCheckoutPayment).toHaveBeenCalledTimes(1);
  });

  it('returns a cart_invalid failure (hard block) when a line becomes unbuyable, even if the price also drifted', async () => {
    const cart = createValidCart();

    vi.mocked(revalidateCartLines).mockResolvedValue([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: false,
        isConfigurationValid: true,
        unitPriceCents: 199_00,
      },
    ]);

    const result = await submitCheckout(createValidInput(), cart);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe('cart_invalid');
    expect(result.ok ? null : result.revalidationResults).toHaveLength(1);
    expect(persistCheckoutOrder).not.toHaveBeenCalled();
    expect(startCheckoutPayment).not.toHaveBeenCalled();
  });

  it('creates an awaiting_payment order and returns the final payment redirect on success', async () => {
    const cart = createValidCart();

    vi.mocked(revalidateCartLines).mockResolvedValue([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 150_00,
      },
    ]);
    vi.mocked(generateNextCheckoutOrderNumber).mockResolvedValue(
      'AF-2026-00001',
    );
    vi.mocked(persistCheckoutOrder).mockImplementation(async (args) => ({
      orderId: 'order-1',
      orderNumber: args.orderNumber,
      createdAt: '2026-04-20T10:00:00.000Z',
      orderDraft: args.orderDraft,
      insertedItemCount: args.orderDraft.items.length,
    }));

    const result = await submitCheckout(createValidInput(), cart);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.orderId).toBe('order-1');
    expect(result.value.orderNumber).toBe('AF-2026-00001');
    expect(result.value.redirectUrl).toBe(
      'http://localhost:3000/podziekowania-za-zakup/?order=AF-2026-00001',
    );
    expect(startCheckoutPayment).toHaveBeenCalledWith({
      paymentRegistrationInput: expect.objectContaining({
        provider: 'przelewy24',
        checkoutOrderId: 'order-1',
        orderNumber: 'AF-2026-00001',
        amount: 150_00,
        currency: 'PLN',
        email: 'jan@example.com',
        mockScenarioId: null,
      }),
    });
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it('freezes the selected mock payment scenario into the payment registration input', async () => {
    const cart = createValidCart();

    vi.mocked(revalidateCartLines).mockResolvedValue([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 150_00,
      },
    ]);
    vi.mocked(generateNextCheckoutOrderNumber).mockResolvedValue(
      'AF-2026-00004',
    );
    vi.mocked(persistCheckoutOrder).mockImplementation(async (args) => ({
      orderId: 'order-4',
      orderNumber: args.orderNumber,
      createdAt: '2026-04-20T10:08:00.000Z',
      orderDraft: args.orderDraft,
      insertedItemCount: args.orderDraft.items.length,
    }));

    const result = await submitCheckout(
      {
        ...createValidInput(),
        mockPaymentScenarioId: 'success_return_before_status',
      },
      cart,
    );

    expect(result.ok).toBe(true);
    expect(startCheckoutPayment).toHaveBeenCalledWith({
      paymentRegistrationInput: expect.objectContaining({
        orderNumber: 'AF-2026-00004',
        mockScenarioId: 'success_return_before_status',
      }),
    });
  });

  it('subscribes the submitted email when newsletter opt-in is enabled', async () => {
    const cart = createValidCart();

    vi.mocked(revalidateCartLines).mockResolvedValue([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 150_00,
      },
    ]);
    vi.mocked(generateNextCheckoutOrderNumber).mockResolvedValue(
      'AF-2026-00003',
    );
    vi.mocked(persistCheckoutOrder).mockImplementation(async (args) => ({
      orderId: 'order-3',
      orderNumber: args.orderNumber,
      createdAt: '2026-04-20T10:06:00.000Z',
      orderDraft: args.orderDraft,
      insertedItemCount: args.orderDraft.items.length,
    }));

    const result = await submitCheckout(
      {
        ...createValidInput(),
        newsletterOptIn: true,
      },
      cart,
    );

    expect(result.ok).toBe(true);
    expect(subscribeToNewsletter).toHaveBeenCalledWith('jan@example.com');
    expect(startCheckoutPayment).toHaveBeenCalledTimes(1);
  });

  it('keeps checkout successful when newsletter subscription fails', async () => {
    const cart = createValidCart();

    vi.mocked(revalidateCartLines).mockResolvedValue([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 150_00,
      },
    ]);
    vi.mocked(generateNextCheckoutOrderNumber).mockResolvedValue(
      'AF-2026-00004',
    );
    vi.mocked(persistCheckoutOrder).mockImplementation(async (args) => ({
      orderId: 'order-4',
      orderNumber: args.orderNumber,
      createdAt: '2026-04-20T10:07:00.000Z',
      orderDraft: args.orderDraft,
      insertedItemCount: args.orderDraft.items.length,
    }));
    vi.mocked(subscribeToNewsletter).mockResolvedValueOnce({
      success: false,
      message: 'Newsletter service not available',
    });

    const result = await submitCheckout(
      {
        ...createValidInput(),
        newsletterOptIn: true,
      },
      cart,
    );

    expect(result.ok).toBe(true);
    expect(subscribeToNewsletter).toHaveBeenCalledWith('jan@example.com');
    expect(startCheckoutPayment).toHaveBeenCalledTimes(1);
  });

  it('returns a payment error when the payment start step fails after order creation', async () => {
    const cart = createValidCart();

    vi.mocked(revalidateCartLines).mockResolvedValue([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 150_00,
      },
    ]);
    vi.mocked(generateNextCheckoutOrderNumber).mockResolvedValue(
      'AF-2026-00005',
    );
    vi.mocked(persistCheckoutOrder).mockImplementation(async (args) => ({
      orderId: 'order-5',
      orderNumber: args.orderNumber,
      createdAt: '2026-04-20T10:08:00.000Z',
      orderDraft: args.orderDraft,
      insertedItemCount: args.orderDraft.items.length,
    }));
    vi.mocked(startCheckoutPayment).mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'payment_registration_failed',
        message:
          'Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.',
      },
    });

    const result = await submitCheckout(createValidInput(), cart);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe(
      'payment_registration_failed',
    );
  });

  it('retries the order number when persistence hits a duplicate order_number conflict', async () => {
    const cart = createValidCart();

    vi.mocked(revalidateCartLines).mockResolvedValue([
      {
        lineId: 'line-1',
        lineType: 'standard',
        isBuyable: true,
        isConfigurationValid: true,
        unitPriceCents: 150_00,
      },
    ]);
    vi.mocked(generateNextCheckoutOrderNumber)
      .mockResolvedValueOnce('AF-2026-00001')
      .mockResolvedValueOnce('AF-2026-00002');
    vi.mocked(persistCheckoutOrder)
      .mockRejectedValueOnce(
        new CheckoutPersistenceError('duplicate', 'duplicate_order_number'),
      )
      .mockImplementationOnce(async (args) => ({
        orderId: 'order-2',
        orderNumber: args.orderNumber,
        createdAt: '2026-04-20T10:05:00.000Z',
        orderDraft: args.orderDraft,
        insertedItemCount: args.orderDraft.items.length,
      }));

    const result = await submitCheckout(createValidInput(), cart);

    expect(result.ok).toBe(true);
    expect(generateNextCheckoutOrderNumber).toHaveBeenCalledTimes(2);
    expect(persistCheckoutOrder).toHaveBeenCalledTimes(2);
    expect(result.ok ? result.value.orderNumber : null).toBe('AF-2026-00002');
    expect(startCheckoutPayment).toHaveBeenCalledTimes(1);
  });
});
