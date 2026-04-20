import { beforeEach, describe, expect, it, vi } from 'vitest';

import { submitCheckout } from './checkout-submit';
import { loadCheckoutAuthContext } from '@/src/global/b2c/checkout/server/auth-context';
import { generateNextCheckoutOrderNumber } from '@/src/global/b2c/checkout/server/order-number';
import {
  CheckoutPersistenceError,
  persistCheckoutOrder,
} from '@/src/global/b2c/checkout/server/persistence';
import { revalidateCartLines } from '@/src/global/b2c/cart/server/revalidation';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import type { CartState } from '@/src/global/b2c/cart/types';
import type { CheckoutSubmitInput } from '@/src/global/b2c/checkout/types';

vi.mock('@/src/global/b2c/checkout/server/auth-context', () => ({
  loadCheckoutAuthContext: vi.fn(),
}));

vi.mock('@/src/global/b2c/checkout/server/order-number', () => ({
  generateNextCheckoutOrderNumber: vi.fn(),
}));

vi.mock('@/src/global/b2c/checkout/server/persistence', async () => {
  const actual = await vi.importActual<
    typeof import('@/src/global/b2c/checkout/server/persistence')
  >('@/src/global/b2c/checkout/server/persistence');

  return {
    ...actual,
    persistCheckoutOrder: vi.fn(),
  };
});

vi.mock('@/src/global/b2c/cart/server/revalidation', () => ({
  revalidateCartLines: vi.fn(),
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
      phone: '+48123123123',
    },
    shippingAddress: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '+48123123123',
      street: 'Testowa 1',
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
    saveToProfile: false,
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
  });

  it('returns a cart_stale failure when live cart truth changes during submit', async () => {
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
    expect(result.ok ? null : result.error.code).toBe('cart_stale');
    expect(result.ok ? null : result.revalidatedCart?.lines[0]?.unitPriceCents).toBe(
      199_00,
    );
    expect(persistCheckoutOrder).not.toHaveBeenCalled();
  });

  it('creates an awaiting_payment order and returns payment registration input on success', async () => {
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
    expect(result.value.orderDraft.currentStatus).toBe('awaiting_payment');
    expect(result.value.orderDraft.paymentProvider).toBe('przelewy24');
    expect(result.value.orderDraft.items).toHaveLength(1);
    expect(result.value.paymentRegistrationInput).toMatchObject({
      provider: 'przelewy24',
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      amountCents: 150_00,
      currency: 'PLN',
      customerEmail: 'jan@example.com',
    });
    expect(result.value.paymentRegistrationInput.urlReturn).toContain(
      '/podziekowania-za-zakup/',
    );
    expect(result.value.paymentRegistrationInput.urlStatus).toContain(
      '/api/platnosci/przelewy24/status/',
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
        new CheckoutPersistenceError(
          'duplicate',
          'duplicate_order_number',
        ),
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
  });
});
