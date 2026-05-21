import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import {
  CheckoutPersistenceError,
  mapCheckoutOrderDraftToOrderItemsInsert,
  mapCheckoutOrderDraftToOrdersInsert,
  persistCheckoutOrder,
} from './persistence';
import type { CheckoutOrderDraft } from '../order-draft';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

function createOrderDraft(): CheckoutOrderDraft {
  return {
    customerEmail: 'jan@example.com',
    customerProfileId: 'profile-1',
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
    discountTotalCents: 0,
    grandTotalCents: 150_00,
    usedDiscount: null,
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
        unitPriceCents: 150_00,
        lineSubtotalCents: 150_00,
        lineDiscountTotalCents: 0,
        lineTotalCents: 150_00,
        isReturnable: true,
        itemSnapshot: {
          model: 'Reference',
          selectedOptions: [],
          productImage: null,
        },
      },
    ],
    sessionContext: {
      isAuthenticated: true,
      authUserId: 'user-1',
      authenticatedEmail: 'jan@example.com',
      customerProfileId: 'profile-1',
    },
    profilePersistence: {
      shouldEnsureProfileAfterSuccessfulPayment: true,
      shouldStoreCheckoutDefaultsAfterSuccessfulPayment: false,
      authUserIdAtCheckout: 'user-1',
      reason: 'update_profile_without_defaults',
    },
  };
}

describe('checkout persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps the checkout order draft into stable orders and order_items payloads', () => {
    const orderDraft = createOrderDraft();

    expect(
      mapCheckoutOrderDraftToOrdersInsert({
        orderNumber: 'AF-2026-00001',
        paymentSessionId: 'AF-2026-00001-session123',
        orderDraft,
      }),
    ).toMatchObject({
      order_number: 'AF-2026-00001',
      customer_profile_id: 'profile-1',
      customer_email: 'jan@example.com',
      current_status: 'awaiting_payment',
      payment_provider: 'przelewy24',
      payment_session_id: 'AF-2026-00001-session123',
      payable_until: '2026-04-20T10:15:00.000Z',
      subtotal_cents: 150_00,
      grand_total_cents: 150_00,
      profile_persistence: {
        shouldEnsureProfileAfterSuccessfulPayment: true,
        shouldStoreCheckoutDefaultsAfterSuccessfulPayment: false,
        authUserIdAtCheckout: 'user-1',
        reason: 'update_profile_without_defaults',
      },
      customer_snapshot: {
        firstName: 'Jan',
        lastName: 'Kowalski',
      },
      shipping_address_snapshot: {
        streetName: 'Testowa',
        buildingNumber: '1',
      },
      created_at: '2026-04-20T10:00:00.000Z',
    });

    expect(
      mapCheckoutOrderDraftToOrderItemsInsert({
        orderId: 'order-1',
        orderDraft,
      }),
    ).toEqual([
      {
        order_id: 'order-1',
        line_type: 'standard',
        line_position: 1,
        quantity: 1,
        product_key: '/produkty/test/',
        product_name: 'Test product',
        brand_name: 'Test brand',
        unit_price_cents: 150_00,
        line_subtotal_cents: 150_00,
        line_discount_total_cents: 0,
        line_total_cents: 150_00,
        item_snapshot: {
          model: 'Reference',
          selectedOptions: [],
          productImage: null,
        },
        is_returnable: true,
        created_at: '2026-04-20T10:00:00.000Z',
        updated_at: '2026-04-20T10:00:00.000Z',
      },
    ]);
  });

  it('cleans up the inserted order when order_items persistence fails', async () => {
    const singleOrderInsertMock = vi.fn().mockResolvedValue({
      data: {
        id: 'order-1',
        order_number: 'AF-2026-00001',
        created_at: '2026-04-20T10:00:00.000Z',
      },
      error: null,
    });
    const selectOrderInsertMock = vi.fn(() => ({
      single: singleOrderInsertMock,
    }));
    const insertOrderMock = vi.fn(() => ({
      select: selectOrderInsertMock,
    }));

    const selectOrderItemsInsertMock = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '23503',
        message: 'boom',
      },
    });
    const insertOrderItemsMock = vi.fn(() => ({
      select: selectOrderItemsInsertMock,
    }));

    const deleteEqMock = vi.fn().mockResolvedValue({
      error: null,
    });
    const deleteMock = vi.fn(() => ({
      eq: deleteEqMock,
    }));

    const fromMock = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          insert: insertOrderMock,
          delete: deleteMock,
        };
      }

      if (table === 'order_items') {
        return {
          insert: insertOrderItemsMock,
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    await expect(
      persistCheckoutOrder({
        orderNumber: 'AF-2026-00001',
        paymentSessionId: 'AF-2026-00001-session123',
        orderDraft: createOrderDraft(),
      }),
    ).rejects.toBeInstanceOf(CheckoutPersistenceError);

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'order-1');
  });
});
