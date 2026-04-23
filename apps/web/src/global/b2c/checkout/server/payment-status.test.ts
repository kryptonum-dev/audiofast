import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import { persistPaidCheckoutOrderProfile } from './payment-profile-persistence';
import { sendCheckoutPaymentConfirmationEmail } from './payment-confirmation-email';
import { getCheckoutPaymentProviderAdapter } from './payment-provider';
import { handleCheckoutPaymentStatusNotification } from './payment-status';
import { confirmCheckoutOrderPayment } from './payment-update';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('./payment-provider', () => ({
  getCheckoutPaymentProviderAdapter: vi.fn(),
}));

vi.mock('./payment-profile-persistence', () => ({
  persistPaidCheckoutOrderProfile: vi.fn(),
}));

vi.mock('./payment-confirmation-email', () => ({
  sendCheckoutPaymentConfirmationEmail: vi.fn(),
}));

vi.mock('./payment-update', () => ({
  confirmCheckoutOrderPayment: vi.fn(),
}));

const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({
  maybeSingle: maybeSingleMock,
}));
const selectMock = vi.fn(() => ({
  eq: eqMock,
}));
const fromMock = vi.fn(() => ({
  select: selectMock,
}));

describe('handleCheckoutPaymentStatusNotification', () => {
  const providerAdapter = {
    verifyTransaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);
    vi.mocked(getCheckoutPaymentProviderAdapter).mockReturnValue(
      providerAdapter as never,
    );
    vi.mocked(persistPaidCheckoutOrderProfile).mockResolvedValue({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      profileId: 'profile-1',
      createdProfile: false,
      updatedProfile: false,
      linkedAuthUser: false,
      linkedOrderToProfile: false,
      skippedReason: null,
    });
    vi.mocked(sendCheckoutPaymentConfirmationEmail).mockResolvedValue();
  });

  it('confirms the order when the provider sends a done notification', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_number: 'AF-2026-00001',
        current_status: 'awaiting_payment',
        customer_email: 'jan@example.com',
        customer_snapshot: {
          firstName: 'Jan',
          lastName: 'Kowalski',
        },
        discount_total_cents: 0,
        grand_total_cents: 230_00,
        invoice_data: null,
        shipping_address_snapshot: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          streetName: 'Testowa',
          buildingNumber: '1',
          apartmentNumber: null,
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL',
          phone: null,
        },
        subtotal_cents: 230_00,
      },
      error: null,
    });
    vi.mocked(providerAdapter.verifyTransaction).mockResolvedValueOnce({
      provider: 'przelewy24',
      orderId: 202600001,
      responseCode: 0,
      data: {
        status: 'success',
      },
      isVerified: true,
      verifiedAt: '2026-04-21T10:00:00.000Z',
      providerReference: 'mock-p24-payment-af202600001',
    });
    vi.mocked(confirmCheckoutOrderPayment).mockResolvedValueOnce({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      currentStatus: 'paid',
      statusHistory: [],
      paymentReference: 'mock-p24-payment-af202600001',
      paymentVerifiedAt: '2026-04-21T10:00:00.000Z',
      paidAt: '2026-04-21T10:00:00.000Z',
      wasAlreadyPaid: false,
    });

    const result = await handleCheckoutPaymentStatusNotification({
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
          detailedStatus:
            'Provider notification confirms payment before the browser returns.',
          paymentId: 'mock-p24-payment-af202600001',
        },
      },
    });

    expect(providerAdapter.verifyTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutOrderId: 'order-1',
        orderNumber: 'AF-2026-00001',
        amount: 230_00,
        currency: 'PLN',
        orderId: 202600001,
        paymentId: 'mock-p24-payment-af202600001',
      }),
    );
    expect(confirmCheckoutOrderPayment).toHaveBeenCalledWith({
      orderId: 'order-1',
      paymentReference: 'mock-p24-payment-af202600001',
      verifiedAt: '2026-04-21T10:00:00.000Z',
    });
    expect(sendCheckoutPaymentConfirmationEmail).toHaveBeenCalledWith({
      order: expect.objectContaining({
        id: 'order-1',
        order_number: 'AF-2026-00001',
        customer_email: 'jan@example.com',
      }),
    });
    expect(persistPaidCheckoutOrderProfile).toHaveBeenCalledWith({
      orderId: 'order-1',
    });
    expect(result).toEqual({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      providerStatus: 'done',
      currentStatus: 'paid',
      wasConfirmed: true,
      wasAlreadyPaid: false,
    });
  });

  it('keeps the order unpaid for non-final provider statuses', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_number: 'AF-2026-00001',
        current_status: 'awaiting_payment',
        customer_email: 'jan@example.com',
        customer_snapshot: {},
        discount_total_cents: 0,
        grand_total_cents: 230_00,
        invoice_data: null,
        shipping_address_snapshot: {},
        subtotal_cents: 230_00,
      },
      error: null,
    });

    const result = await handleCheckoutPaymentStatusNotification({
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
          generalStatus: 'pending',
          detailedStatus: 'Payment is still pending.',
          paymentId: 'mock-p24-payment-af202600001',
        },
      },
    });

    expect(providerAdapter.verifyTransaction).not.toHaveBeenCalled();
    expect(confirmCheckoutOrderPayment).not.toHaveBeenCalled();
    expect(sendCheckoutPaymentConfirmationEmail).not.toHaveBeenCalled();
    expect(persistPaidCheckoutOrderProfile).not.toHaveBeenCalled();
    expect(result).toEqual({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      providerStatus: 'pending',
      currentStatus: 'awaiting_payment',
      wasConfirmed: false,
      wasAlreadyPaid: false,
    });
  });

  it('keeps payment confirmation successful when profile persistence fails', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_number: 'AF-2026-00001',
        current_status: 'awaiting_payment',
        customer_email: 'jan@example.com',
        customer_snapshot: {},
        discount_total_cents: 0,
        grand_total_cents: 230_00,
        invoice_data: null,
        shipping_address_snapshot: {},
        subtotal_cents: 230_00,
      },
      error: null,
    });
    vi.mocked(providerAdapter.verifyTransaction).mockResolvedValueOnce({
      provider: 'przelewy24',
      orderId: 202600001,
      responseCode: 0,
      data: {
        status: 'success',
      },
      isVerified: true,
      verifiedAt: '2026-04-21T10:00:00.000Z',
      providerReference: 'mock-p24-payment-af202600001',
    });
    vi.mocked(confirmCheckoutOrderPayment).mockResolvedValueOnce({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      currentStatus: 'paid',
      statusHistory: [],
      paymentReference: 'mock-p24-payment-af202600001',
      paymentVerifiedAt: '2026-04-21T10:00:00.000Z',
      paidAt: '2026-04-21T10:00:00.000Z',
      wasAlreadyPaid: true,
    });
    vi.mocked(persistPaidCheckoutOrderProfile).mockRejectedValueOnce(
      new Error('boom'),
    );

    const result = await handleCheckoutPaymentStatusNotification({
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
          detailedStatus: 'Payment has been confirmed.',
          paymentId: 'mock-p24-payment-af202600001',
        },
      },
    });

    expect(result).toEqual({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      providerStatus: 'done',
      currentStatus: 'paid',
      wasConfirmed: true,
      wasAlreadyPaid: true,
    });
  });

  it('does not resend the confirmation email when the order was already paid', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_number: 'AF-2026-00001',
        current_status: 'paid',
        customer_email: 'jan@example.com',
        customer_snapshot: {},
        discount_total_cents: 0,
        grand_total_cents: 230_00,
        invoice_data: null,
        shipping_address_snapshot: {},
        subtotal_cents: 230_00,
      },
      error: null,
    });
    vi.mocked(providerAdapter.verifyTransaction).mockResolvedValueOnce({
      provider: 'przelewy24',
      orderId: 202600001,
      responseCode: 0,
      data: {
        status: 'success',
      },
      isVerified: true,
      verifiedAt: '2026-04-21T10:00:00.000Z',
      providerReference: 'mock-p24-payment-af202600001',
    });
    vi.mocked(confirmCheckoutOrderPayment).mockResolvedValueOnce({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      currentStatus: 'paid',
      statusHistory: [],
      paymentReference: 'mock-p24-payment-af202600001',
      paymentVerifiedAt: '2026-04-21T10:00:00.000Z',
      paidAt: '2026-04-21T10:00:00.000Z',
      wasAlreadyPaid: true,
    });

    await handleCheckoutPaymentStatusNotification({
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
          detailedStatus: 'Payment has been confirmed.',
          paymentId: 'mock-p24-payment-af202600001',
        },
      },
    });

    expect(sendCheckoutPaymentConfirmationEmail).not.toHaveBeenCalled();
    expect(persistPaidCheckoutOrderProfile).toHaveBeenCalledWith({
      orderId: 'order-1',
    });
  });

  it('keeps payment confirmation successful when the confirmation email fails', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_number: 'AF-2026-00001',
        current_status: 'awaiting_payment',
        customer_email: 'jan@example.com',
        customer_snapshot: {},
        discount_total_cents: 0,
        grand_total_cents: 230_00,
        invoice_data: null,
        shipping_address_snapshot: {},
        subtotal_cents: 230_00,
      },
      error: null,
    });
    vi.mocked(providerAdapter.verifyTransaction).mockResolvedValueOnce({
      provider: 'przelewy24',
      orderId: 202600001,
      responseCode: 0,
      data: {
        status: 'success',
      },
      isVerified: true,
      verifiedAt: '2026-04-21T10:00:00.000Z',
      providerReference: 'mock-p24-payment-af202600001',
    });
    vi.mocked(confirmCheckoutOrderPayment).mockResolvedValueOnce({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      currentStatus: 'paid',
      statusHistory: [],
      paymentReference: 'mock-p24-payment-af202600001',
      paymentVerifiedAt: '2026-04-21T10:00:00.000Z',
      paidAt: '2026-04-21T10:00:00.000Z',
      wasAlreadyPaid: false,
    });
    vi.mocked(sendCheckoutPaymentConfirmationEmail).mockRejectedValueOnce(
      new Error('boom'),
    );

    const result = await handleCheckoutPaymentStatusNotification({
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
          detailedStatus: 'Payment has been confirmed.',
          paymentId: 'mock-p24-payment-af202600001',
        },
      },
    });

    expect(result).toEqual({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      providerStatus: 'done',
      currentStatus: 'paid',
      wasConfirmed: true,
      wasAlreadyPaid: false,
    });
    expect(persistPaidCheckoutOrderProfile).toHaveBeenCalledWith({
      orderId: 'order-1',
    });
  });
});
