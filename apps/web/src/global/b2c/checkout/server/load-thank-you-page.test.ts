import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import { loadThankYouPageData } from './load-thank-you-page';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const maybeSingleMock = vi.fn();
const orderMock = vi.fn();
const eqMock = vi.fn(() => ({
  maybeSingle: maybeSingleMock,
  order: orderMock,
}));
const selectMock = vi.fn(() => ({
  eq: eqMock,
}));
const fromMock = vi.fn(() => ({
  select: selectMock,
}));

function createOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_number: 'AF-2026-00001',
    current_status: 'awaiting_payment',
    payable_until: '2099-04-23T10:15:00.000Z',
    customer_email: 'jan@example.com',
    customer_profile_id: null,
    customer_snapshot: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123456789',
    },
    shipping_address_snapshot: {
      city: 'Warszawa',
      postalCode: '00-001',
      country: 'PL',
    },
    subtotal_cents: 120_00,
    discount_total_cents: 0,
    grand_total_cents: 120_00,
    used_discount: null,
    ...overrides,
  };
}

describe('loadThankYouPageData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderMock.mockResolvedValue({
      data: [],
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);
  });

  it('returns invalid_access when the order number is missing', async () => {
    const result = await loadThankYouPageData({});

    expect(result.orderNumber).toBeNull();
    expect(result.state.id).toBe('invalid_access');
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('loads an unpaid order and resolves the awaiting_payment state', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: createOrder(),
      error: null,
    });

    const result = await loadThankYouPageData({
      order: 'AF-2026-00001',
    });

    expect(result.orderNumber).toBe('AF-2026-00001');
    expect(result.state.id).toBe('awaiting_payment');
    expect(result.state.shouldPoll).toBe(true);
  });

  it('loads an awaiting confirmation order and resolves the paid thank-you state', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: createOrder({
        current_status: 'awaiting_confirmation',
        payable_until: '2026-04-23T10:15:00.000Z',
        customer_profile_id: 'profile-1',
        used_discount: {
          couponCode: 'WIOSNA10',
        },
        discount_total_cents: 10_00,
        grand_total_cents: 110_00,
      }),
      error: null,
    });
    orderMock.mockResolvedValueOnce({
      data: [
        {
          id: 'item-1',
          order_id: 'order-1',
          line_type: 'standard',
          line_position: 0,
          quantity: 1,
          product_key: '/produkty/test/',
          product_name: 'Test product',
          brand_name: 'Test brand',
          unit_price_cents: 120_00,
          line_subtotal_cents: 120_00,
          line_discount_total_cents: 10_00,
          line_total_cents: 110_00,
          item_snapshot: {},
          is_returnable: true,
          created_at: '2026-04-23T10:15:00.000Z',
          updated_at: '2026-04-23T10:15:00.000Z',
        },
      ],
      error: null,
    });

    const result = await loadThankYouPageData({
      order: 'AF-2026-00001',
    });

    expect(result.state.id).toBe('paid');
    expect(result.state.shouldPoll).toBe(false);
    expect(result.analytics).toMatchObject({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      customerEmail: 'jan@example.com',
      customerProfileId: 'profile-1',
      grandTotalCents: 110_00,
      couponCode: 'WIOSNA10',
      items: [
        {
          lineType: 'standard',
          productKey: '/produkty/test/',
          lineDiscountTotalCents: 10_00,
        },
      ],
    });
  });

  it('resolves expired when an unpaid order is past the payment window', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: createOrder({
        payable_until: '2020-04-23T10:15:00.000Z',
      }),
      error: null,
    });

    const result = await loadThankYouPageData({
      order: 'AF-2026-00001',
    });

    expect(result.state.id).toBe('expired');
    expect(result.state.shouldPoll).toBe(false);
  });

  it('falls back to invalid_access for unsupported persisted statuses', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: createOrder({
        current_status: 'cancelled',
      }),
      error: null,
    });

    const result = await loadThankYouPageData({
      order: 'AF-2026-00001',
    });

    expect(result.state.id).toBe('invalid_access');
  });

  it('falls back to invalid_access when the order cannot be found', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await loadThankYouPageData({
      order: 'AF-2026-99999',
    });

    expect(result.orderNumber).toBe('AF-2026-99999');
    expect(result.state.id).toBe('invalid_access');
  });
});
