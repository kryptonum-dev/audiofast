import { describe, expect, it } from 'vitest';

import { aggregateAdminAnalyticsRows } from './analytics';

const RANGE = {
  from: new Date('2026-05-01T00:00:00.000Z'),
  fromIso: '2026-05-01T00:00:00.000Z',
  to: new Date('2026-05-31T23:59:59.000Z'),
  toIso: '2026-05-31T23:59:59.000Z',
};

describe('admin analytics helpers', () => {
  it('aggregates revenue while explicitly excluding cancelled and returned rows', () => {
    const result = aggregateAdminAnalyticsRows({
      groupBy: 'day',
      range: RANGE,
      rows: [
        {
          current_status: 'paid',
          discount_total_cents: 1000,
          grand_total_cents: 9000,
          id: 'order-1',
          order_items: [{ quantity: 2 }],
          paid_at: '2026-05-06T08:00:00.000Z',
        },
        {
          current_status: 'returned',
          discount_total_cents: 500,
          grand_total_cents: 4500,
          id: 'order-2',
          order_items: [{ quantity: 1 }],
          paid_at: '2026-05-06T09:00:00.000Z',
        },
        {
          current_status: 'completed',
          discount_total_cents: 0,
          grand_total_cents: 12000,
          id: 'order-3',
          order_items: [{ quantity: 1 }, { quantity: 3 }],
          paid_at: '2026-05-07T08:00:00.000Z',
        },
      ],
    });

    expect(result.revenue).toEqual({
      averageOrderValueCents: 10500,
      countingMode: 'paid_orders_excluding_cancelled_and_returned',
      discountTotalCents: 1000,
      grossPaidRevenueCents: 25500,
      paidOrderCount: 3,
      revenueCents: 21000,
      revenueOrderCount: 2,
    });
    expect(result.statusCounts).toEqual([
      { count: 1, status: 'completed' },
      { count: 1, status: 'paid' },
      { count: 1, status: 'returned' },
    ]);
    expect(result.series).toEqual([
      {
        discountTotalCents: 1000,
        digitalSalesCount: 2,
        grossPaidRevenueCents: 9000,
        label: '2026-05-06',
        paidOrderCount: 1,
        revenueCents: 9000,
      },
      {
        discountTotalCents: 0,
        digitalSalesCount: 4,
        grossPaidRevenueCents: 12000,
        label: '2026-05-07',
        paidOrderCount: 1,
        revenueCents: 12000,
      },
    ]);
  });

  it('groups revenue by month start when requested', () => {
    const result = aggregateAdminAnalyticsRows({
      groupBy: 'month',
      range: RANGE,
      rows: [
        {
          current_status: 'paid',
          discount_total_cents: 0,
          grand_total_cents: 9000,
          id: 'order-1',
          order_items: [{ quantity: 2 }],
          paid_at: '2026-05-06T08:00:00.000Z',
        },
        {
          current_status: 'completed',
          discount_total_cents: 1000,
          grand_total_cents: 12000,
          id: 'order-2',
          order_items: [{ quantity: 1 }],
          paid_at: '2026-05-21T08:00:00.000Z',
        },
      ],
    });

    expect(result.series).toEqual([
      {
        digitalSalesCount: 3,
        discountTotalCents: 1000,
        grossPaidRevenueCents: 21000,
        label: '2026-05-01',
        paidOrderCount: 2,
        revenueCents: 21000,
      },
    ]);
  });
});
