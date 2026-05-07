import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';

import {
  parseAdminDateRange,
  type AdminDateRange,
} from '@/src/global/b2c/admin/server/date-range';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';

type AnalyticsOrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'current_status'
  | 'discount_total_cents'
  | 'grand_total_cents'
  | 'id'
  | 'paid_at'
> & {
  order_items?: Array<
    Pick<Database['public']['Tables']['order_items']['Row'], 'quantity'>
  > | null;
};

export type AdminAnalyticsGroupBy = 'day' | 'month' | 'none' | 'week';

export type AdminAnalyticsSeriesPoint = {
  digitalSalesCount: number;
  label: string;
  paidOrderCount: number;
  grossPaidRevenueCents: number;
  revenueCents: number;
  discountTotalCents: number;
};

export type AdminAnalyticsResult = {
  period: {
    from: string;
    to: string;
    groupBy: AdminAnalyticsGroupBy;
  };
  revenue: {
    countingMode: 'paid_orders_excluding_cancelled_and_returned';
    paidOrderCount: number;
    revenueOrderCount: number;
    grossPaidRevenueCents: number;
    revenueCents: number;
    averageOrderValueCents: number;
    discountTotalCents: number;
  };
  statusCounts: Array<{
    status: string;
    count: number;
  }>;
  series: AdminAnalyticsSeriesPoint[];
};

export class AdminAnalyticsError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid_analytics_query' | 'database_error',
    public readonly status: number,
    public readonly causeError: PostgrestError | Error | null = null,
  ) {
    super(message);
    this.name = 'AdminAnalyticsError';
  }
}

function parseGroupBy(value: string | null): AdminAnalyticsGroupBy {
  if (!value || value === 'none') {
    return 'none';
  }

  if (value === 'day' || value === 'month' || value === 'week') {
    return value;
  }

  throw new AdminAnalyticsError(
    'groupBy must be day, week, month, or none.',
    'invalid_analytics_query',
    400,
  );
}

function getSeriesLabel(date: Date, groupBy: AdminAnalyticsGroupBy): string {
  if (groupBy === 'none') {
    return 'total';
  }

  if (groupBy === 'day') {
    return date.toISOString().slice(0, 10);
  }

  if (groupBy === 'month') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);
  }

  const weekStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = weekStart.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + diff);

  return weekStart.toISOString().slice(0, 10);
}

function isRevenueOrder(row: AnalyticsOrderRow): boolean {
  return row.current_status !== 'cancelled' && row.current_status !== 'returned';
}

export function aggregateAdminAnalyticsRows(args: {
  groupBy: AdminAnalyticsGroupBy;
  range: AdminDateRange;
  rows: AnalyticsOrderRow[];
}): AdminAnalyticsResult {
  const statusCounts = new Map<string, number>();
  const series = new Map<string, AdminAnalyticsSeriesPoint>();
  let grossPaidRevenueCents = 0;
  let revenueCents = 0;
  let discountTotalCents = 0;
  let revenueOrderCount = 0;

  for (const row of args.rows) {
    statusCounts.set(
      row.current_status,
      (statusCounts.get(row.current_status) ?? 0) + 1,
    );
    grossPaidRevenueCents += row.grand_total_cents;

    if (!isRevenueOrder(row)) {
      continue;
    }

    const digitalSalesCount =
      row.order_items?.reduce((total, item) => total + item.quantity, 0) ?? 0;

    revenueOrderCount += 1;
    revenueCents += row.grand_total_cents;
    discountTotalCents += row.discount_total_cents;

    if (args.groupBy !== 'none' && row.paid_at) {
      const label = getSeriesLabel(new Date(row.paid_at), args.groupBy);
      const existing =
        series.get(label) ??
        ({
          discountTotalCents: 0,
          digitalSalesCount: 0,
          grossPaidRevenueCents: 0,
          label,
          paidOrderCount: 0,
          revenueCents: 0,
        } satisfies AdminAnalyticsSeriesPoint);

      existing.digitalSalesCount += digitalSalesCount;
      existing.grossPaidRevenueCents += row.grand_total_cents;
      existing.paidOrderCount += 1;
      existing.revenueCents += row.grand_total_cents;
      existing.discountTotalCents += row.discount_total_cents;
      series.set(label, existing);
    }
  }

  return {
    period: {
      from: args.range.fromIso,
      to: args.range.toIso,
      groupBy: args.groupBy,
    },
    revenue: {
      countingMode: 'paid_orders_excluding_cancelled_and_returned',
      paidOrderCount: args.rows.length,
      revenueOrderCount,
      grossPaidRevenueCents,
      revenueCents,
      averageOrderValueCents:
        revenueOrderCount > 0 ? Math.round(revenueCents / revenueOrderCount) : 0,
      discountTotalCents,
    },
    statusCounts: Array.from(statusCounts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((left, right) => left.status.localeCompare(right.status)),
    series: Array.from(series.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    ),
  };
}

export async function loadAdminAnalytics(args: {
  now?: Date;
  searchParams: URLSearchParams;
}): Promise<AdminAnalyticsResult> {
  const range = parseAdminDateRange(args.searchParams, {
    defaultDays: 30,
    maxDays: 366,
    now: args.now,
  });
  const groupBy = parseGroupBy(args.searchParams.get('groupBy'));
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      'current_status, discount_total_cents, grand_total_cents, id, paid_at, order_items(quantity)',
    )
    .not('paid_at', 'is', null)
    .gte('paid_at', range.fromIso)
    .lte('paid_at', range.toIso);

  if (error) {
    throw new AdminAnalyticsError(
      'Failed to load B2C operational analytics.',
      'database_error',
      500,
      error,
    );
  }

  return aggregateAdminAnalyticsRows({
    groupBy,
    range,
    rows: (data ?? []) as AnalyticsOrderRow[],
  });
}
