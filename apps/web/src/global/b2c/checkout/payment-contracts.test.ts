import { describe, expect, it } from 'vitest';

import {
  buildP24TransactionRegistrationInput,
  type P24TransactionRegisterCartItem,
} from './payment-contracts';
import type { CheckoutOrderDraft } from './order-draft';

function createOrderDraft(
  overrides: Partial<CheckoutOrderDraft> = {},
): CheckoutOrderDraft {
  return {
    customerEmail: 'jan@example.com',
    customerProfileId: null,
    customerSnapshot: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      email: 'jan@example.com',
      phone: '123123123',
    },
    shippingAddressSnapshot: {
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
    invoiceData: null,
    subtotalCents: 450_00,
    discountTotalCents: 50_00,
    grandTotalCents: 400_00,
    usedDiscount: {
      couponId: 'coupon-1',
      couponCode: 'TEST50',
      discountType: 'fixed_order',
      discountValueCents: 50_00,
      discountPercent: null,
      matchedProductKeys: [],
      totalDiscountCents: 50_00,
    },
    currentStatus: 'awaiting_payment',
    statusHistory: [
      {
        status: 'awaiting_payment',
        changedAt: '2026-04-20T10:00:00.000Z',
        source: 'system',
      },
    ],
    paymentProvider: 'przelewy24',
    paymentReference: null,
    paymentVerifiedAt: null,
    payableUntil: '2026-04-20T10:15:00.000Z',
    paidAt: null,
    shipmentData: null,
    items: [
      {
        lineId: 'line-1',
        lineType: 'standard',
        linePosition: 1,
        productId: 'product-1',
        productKey: '/produkty/test/',
        productName: 'Test product',
        brandName: 'Test brand',
        quantity: 1,
        unitPriceCents: 450_00,
        lineSubtotalCents: 450_00,
        lineDiscountTotalCents: 50_00,
        lineTotalCents: 400_00,
        isReturnable: true,
        itemSnapshot: {
          model: 'Reference',
          selectedOptions: [],
          productImage: null,
        },
      },
    ],
    sessionContext: {
      isAuthenticated: false,
      authUserId: null,
      authenticatedEmail: null,
      customerProfileId: null,
    },
    profilePersistence: {
      shouldEnsureProfileAfterSuccessfulPayment: false,
      shouldStoreCheckoutDefaultsAfterSuccessfulPayment: false,
      authUserIdAtCheckout: null,
      reason: 'create_profile_without_defaults',
    },
    ...overrides,
  };
}

function getP24CartTotal(cart: P24TransactionRegisterCartItem[]): number {
  return cart.reduce((total, item) => total + item.price * item.quantity, 0);
}

describe('buildP24TransactionRegistrationInput', () => {
  it('keeps the P24 cart total equal to the discounted transaction amount', () => {
    const registrationInput = buildP24TransactionRegistrationInput({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00033',
      orderDraft: createOrderDraft(),
      urlReturn: 'https://audiofast.pl/podziekowania-za-zakup/AF-2026-00033/',
      urlStatus: 'https://audiofast.pl/api/payment/status/',
    });

    expect(registrationInput.amount).toBe(400_00);
    expect(getP24CartTotal(registrationInput.cart)).toBe(
      registrationInput.amount,
    );
    expect(registrationInput.cart).toEqual([
      expect.objectContaining({
        quantity: 1,
        price: 400_00,
        number: 'AF-2026-00033',
      }),
    ]);
  });
});
