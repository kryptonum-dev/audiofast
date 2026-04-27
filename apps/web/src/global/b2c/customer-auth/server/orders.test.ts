import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import {
  CUSTOMER_ORDERS_ITEMS_PER_PAGE,
  parseCustomerOrdersPage,
  parseCustomerOrdersSortBy,
} from '../orders-listing-query';
import {
  CUSTOMER_ORDERS_LIST_SELECT,
  type CustomerOrdersListRow,
  loadCustomerOrdersForPanel,
  mapCustomerOrdersListRow,
} from './orders';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

function createOrderRow(
  overrides: Partial<CustomerOrdersListRow> = {},
): CustomerOrdersListRow {
  return {
    id: 'order-1',
    order_number: 'AF-2026-00001',
    current_status: 'paid',
    payable_until: '2026-04-24T12:00:00.000Z',
    created_at: '2026-04-24T10:00:00.000Z',
    grand_total_cents: 150_00,
    order_items: [],
    ...overrides,
  };
}

function createOrdersSelectChain(result: {
  data: unknown;
  error: unknown;
  count?: number | null;
}) {
  const rangeMock = vi.fn().mockResolvedValue({
    data: result.data,
    error: result.error,
    count: result.count ?? null,
  });
  const orderMock = vi.fn(() => ({
    range: rangeMock,
  }));
  const orMock = vi.fn(() => ({
    order: orderMock,
  }));
  const ilikeMock = vi.fn(() => ({
    or: orMock,
  }));
  const selectMock = vi.fn(() => ({
    ilike: ilikeMock,
  }));

  return {
    rangeMock,
    orderMock,
    orMock,
    ilikeMock,
    selectMock,
  };
}

describe('mapCustomerOrdersListRow', () => {
  it('maps a database row to the customer panel order-list contract', () => {
    const result = mapCustomerOrdersListRow(
      createOrderRow(),
      new Date('2026-04-24T11:00:00.000Z'),
    );

    expect(result).toEqual({
      id: 'order-1',
      orderNumber: 'AF-2026-00001',
      currentStatus: 'paid',
      payableUntil: '2026-04-24T12:00:00.000Z',
      createdAt: '2026-04-24T10:00:00.000Z',
      grandTotalCents: 150_00,
      accessKind: 'customer_visible',
      leadItem: null,
      totalItemCount: 0,
    });
  });

  it('exposes the first order item (sorted by line_position) as the leadItem', () => {
    const result = mapCustomerOrdersListRow(
      createOrderRow({
        order_items: [
          {
            line_position: 2,
            product_name: 'Stożek',
            brand_name: 'Vibrapod',
            item_snapshot: { model: null, selectedOptions: [] },
          },
          {
            line_position: 1,
            product_name: 'Prestige',
            brand_name: 'Artesania Audio',
            item_snapshot: {
              model: '2-półkowy',
              selectedOptions: [],
              productImage: {
                id: 'image-abc-100x100-webp',
                preview: 'data:image/png;base64,xyz',
                alt: null,
                naturalWidth: 100,
                naturalHeight: 100,
                hotspot: null,
                crop: null,
              },
            },
          },
        ],
      }),
      new Date('2026-04-24T11:00:00.000Z'),
    );

    expect(result.leadItem).toEqual({
      productName: 'Prestige',
      brandName: 'Artesania Audio',
      productImage: {
        id: 'image-abc-100x100-webp',
        preview: 'data:image/png;base64,xyz',
        alt: null,
        naturalWidth: 100,
        naturalHeight: 100,
        hotspot: null,
        crop: null,
      },
    });
    expect(result.totalItemCount).toBe(2);
  });

  it('returns leadItem with null productImage for legacy snapshots without an image', () => {
    const result = mapCustomerOrdersListRow(
      createOrderRow({
        order_items: [
          {
            line_position: 1,
            product_name: 'Stożek',
            brand_name: 'Vibrapod',
            item_snapshot: { model: null, selectedOptions: [] },
          },
        ],
      }),
    );

    expect(result.leadItem).toEqual({
      productName: 'Stożek',
      brandName: 'Vibrapod',
      productImage: null,
    });
  });

  it('marks active awaiting_payment rows as temporarily visible', () => {
    const result = mapCustomerOrdersListRow(
      createOrderRow({
        current_status: 'awaiting_payment',
        payable_until: '2026-04-24T12:30:00.000Z',
      }),
      new Date('2026-04-24T11:00:00.000Z'),
    );

    expect(result.accessKind).toBe('awaiting_payment_active');
  });
});

describe('loadCustomerOrdersForPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries orders by normalized customer email and newest-first order', async () => {
    const ordersSelect = createOrdersSelectChain({
      data: [createOrderRow()],
      error: null,
      count: 1,
    });
    const fromMock = vi.fn(() => ({
      select: ordersSelect.selectMock,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await loadCustomerOrdersForPanel({
      normalizedEmail: 'jan@example.com',
      now: new Date('2026-04-24T11:00:00.000Z'),
    });

    expect(fromMock).toHaveBeenCalledWith('orders');
    expect(ordersSelect.selectMock).toHaveBeenCalledWith(
      CUSTOMER_ORDERS_LIST_SELECT,
      { count: 'exact' },
    );
    expect(ordersSelect.ilikeMock).toHaveBeenCalledWith(
      'customer_email',
      'jan@example.com',
    );
    expect(ordersSelect.orMock).toHaveBeenCalledWith(
      expect.stringContaining('current_status.in.(paid,processing,shipped'),
    );
    expect(ordersSelect.orMock).toHaveBeenCalledWith(
      expect.stringContaining('payable_until.gt.2026-04-24T11:00:00.000Z'),
    );
    expect(ordersSelect.orderMock).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(ordersSelect.rangeMock).toHaveBeenCalledWith(
      0,
      CUSTOMER_ORDERS_ITEMS_PER_PAGE - 1,
    );
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]?.orderNumber).toBe('AF-2026-00001');
    expect(result.totalCount).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('requests the selected sort and page range from Supabase', async () => {
    const ordersSelect = createOrdersSelectChain({
      data: [createOrderRow()],
      error: null,
      count: 17,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: ordersSelect.selectMock,
      })),
    } as never);

    const result = await loadCustomerOrdersForPanel({
      normalizedEmail: 'jan@example.com',
      page: 2,
      pageSize: 8,
      sortBy: 'totalAsc',
      now: new Date('2026-04-24T11:00:00.000Z'),
    });

    expect(ordersSelect.orderMock).toHaveBeenCalledWith('grand_total_cents', {
      ascending: true,
    });
    expect(ordersSelect.rangeMock).toHaveBeenCalledWith(8, 15);
    expect(result.currentPage).toBe(2);
    expect(result.pageSize).toBe(8);
    expect(result.totalCount).toBe(17);
    expect(result.totalPages).toBe(3);
    expect(result.sortBy).toBe('totalAsc');
  });

  it('returns an empty array when Supabase returns no rows', async () => {
    const ordersSelect = createOrdersSelectChain({
      data: null,
      error: null,
      count: 0,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: ordersSelect.selectMock,
      })),
    } as never);

    await expect(
      loadCustomerOrdersForPanel({ normalizedEmail: 'jan@example.com' }),
    ).resolves.toEqual({
      orders: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: CUSTOMER_ORDERS_ITEMS_PER_PAGE,
      totalPages: 0,
      sortBy: 'newest',
    });
  });

  it('throws Supabase errors so the page loader can handle them', async () => {
    const error = new Error('database unavailable');
    const ordersSelect = createOrdersSelectChain({
      data: null,
      error,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: ordersSelect.selectMock,
      })),
    } as never);

    await expect(
      loadCustomerOrdersForPanel({ normalizedEmail: 'jan@example.com' }),
    ).rejects.toThrow(error);
  });
});

describe('customer orders query parsing', () => {
  it('parses page numbers defensively', () => {
    expect(parseCustomerOrdersPage('3')).toBe(3);
    expect(parseCustomerOrdersPage(['4'])).toBe(4);
    expect(parseCustomerOrdersPage('0')).toBe(1);
    expect(parseCustomerOrdersPage('abc')).toBe(1);
  });

  it('allows only known sort values', () => {
    expect(parseCustomerOrdersSortBy('oldest')).toBe('oldest');
    expect(parseCustomerOrdersSortBy('totalDesc')).toBe('totalDesc');
    expect(parseCustomerOrdersSortBy('unknown')).toBe('newest');
  });
});
