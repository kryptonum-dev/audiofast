import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CheckoutOrderDraft } from '../order-draft';
import { sendCheckoutPaymentConfirmationEmail } from './payment-confirmation-email';
import { persistPaidCheckoutOrderProfile } from './payment-profile-persistence';
import { confirmCheckoutOrderPayment } from './payment-update';
import {
  buildZeroTotalPaymentReference,
  completeZeroTotalCheckoutPayment,
} from './payment-zero-total';

vi.mock('./payment-confirmation-email', () => ({
  sendCheckoutPaymentConfirmationEmail: vi.fn(),
}));

vi.mock('./payment-profile-persistence', () => ({
  persistPaidCheckoutOrderProfile: vi.fn(),
}));

vi.mock('./payment-update', () => ({
  confirmCheckoutOrderPayment: vi.fn(),
}));

function createZeroTotalOrderDraft(): CheckoutOrderDraft {
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
    subtotalCents: 150_00,
    discountTotalCents: 150_00,
    grandTotalCents: 0,
    usedDiscount: {
      couponId: 'coupon-free-100',
      couponCode: 'FREE100',
      discountType: 'percent_order',
      discountValueCents: null,
      discountPercent: 100,
      matchedProductKeys: [],
      totalDiscountCents: 150_00,
    },
    currentStatus: 'awaiting_payment',
    statusHistory: [
      {
        status: 'awaiting_payment',
        changedAt: '2026-04-20T10:00:00.000Z',
        source: 'system',
      },
    ],
    paymentProvider: 'zero_total',
    paymentReference: null,
    paymentVerifiedAt: null,
    payableUntil: '2026-04-20T10:15:00.000Z',
    paidAt: null,
    shipmentData: null,
    items: [],
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
  };
}

describe('zero-total checkout payment completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(confirmCheckoutOrderPayment).mockResolvedValue({
      orderId: 'order-13',
      orderNumber: 'AF-2026-00013',
      currentStatus: 'awaiting_confirmation',
      statusHistory: [],
      paymentReference: 'zero-total:AF-2026-00013',
      paymentVerifiedAt: '2026-04-20T10:00:01.000Z',
      paidAt: '2026-04-20T10:00:01.000Z',
      wasAlreadyPaid: false,
    });
    vi.mocked(sendCheckoutPaymentConfirmationEmail).mockResolvedValue();
    vi.mocked(persistPaidCheckoutOrderProfile).mockResolvedValue({
      orderId: 'order-13',
      orderNumber: 'AF-2026-00013',
      profileId: null,
      createdProfile: false,
      updatedProfile: false,
      linkedAuthUser: false,
      linkedOrderToProfile: false,
      skippedReason: 'profile_persistence_disabled',
    });
  });

  it('uses a stable internal payment reference', () => {
    expect(buildZeroTotalPaymentReference('AF-2026-00013')).toBe(
      'zero-total:AF-2026-00013',
    );
  });

  it('confirms a zero-total order internally and returns the thank-you redirect', async () => {
    const result = await completeZeroTotalCheckoutPayment({
      order: {
        orderId: 'order-13',
        orderNumber: 'AF-2026-00013',
        orderDraft: createZeroTotalOrderDraft(),
      },
      redirectUrl: 'https://audiofast.pl/podziekowania-za-zakup/AF-2026-00013/',
    });

    expect(confirmCheckoutOrderPayment).toHaveBeenCalledWith({
      orderId: 'order-13',
      paymentReference: 'zero-total:AF-2026-00013',
      verifiedAt: expect.any(String),
      expectedPaymentProvider: 'zero_total',
      enforcePayableUntil: false,
    });
    expect(sendCheckoutPaymentConfirmationEmail).toHaveBeenCalledWith({
      order: expect.objectContaining({
        id: 'order-13',
        order_number: 'AF-2026-00013',
        customer_email: 'jan@example.com',
        subtotal_cents: 150_00,
        discount_total_cents: 150_00,
        grand_total_cents: 0,
      }),
    });
    expect(persistPaidCheckoutOrderProfile).toHaveBeenCalledWith({
      orderId: 'order-13',
    });
    expect(result).toEqual({
      orderId: 'order-13',
      orderNumber: 'AF-2026-00013',
      redirectUrl: 'https://audiofast.pl/podziekowania-za-zakup/AF-2026-00013/',
      registration: null,
      wasAlreadyPaid: false,
    });
  });

  it('does not resend the confirmation email when the order was already paid', async () => {
    vi.mocked(confirmCheckoutOrderPayment).mockResolvedValueOnce({
      orderId: 'order-13',
      orderNumber: 'AF-2026-00013',
      currentStatus: 'awaiting_confirmation',
      statusHistory: [],
      paymentReference: 'zero-total:AF-2026-00013',
      paymentVerifiedAt: '2026-04-20T10:00:01.000Z',
      paidAt: '2026-04-20T10:00:01.000Z',
      wasAlreadyPaid: true,
    });

    await completeZeroTotalCheckoutPayment({
      order: {
        orderId: 'order-13',
        orderNumber: 'AF-2026-00013',
        orderDraft: createZeroTotalOrderDraft(),
      },
      redirectUrl: 'https://audiofast.pl/podziekowania-za-zakup/AF-2026-00013/',
    });

    expect(sendCheckoutPaymentConfirmationEmail).not.toHaveBeenCalled();
    expect(persistPaidCheckoutOrderProfile).toHaveBeenCalledWith({
      orderId: 'order-13',
    });
  });
});
