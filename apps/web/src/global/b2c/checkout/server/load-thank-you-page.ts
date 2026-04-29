import 'server-only';

import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';

import {
  type CheckoutThankYouResolvableOrderStatus,
  type CheckoutThankYouStateDefinition,
  resolveCheckoutThankYouState,
} from './thank-you-state';

type ThankYouOrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  'id' | 'order_number' | 'current_status' | 'payable_until'
>;

export type LoadThankYouPageInput = {
  order?: string;
  refresh?: string;
};

export type LoadThankYouPageData = {
  orderNumber: string | null;
  state: CheckoutThankYouStateDefinition;
};

function normalizeOrderNumber(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeResolvableOrderStatus(
  value: string,
): CheckoutThankYouResolvableOrderStatus | null {
  if (value === 'awaiting_payment' || value === 'paid') {
    return value;
  }

  return null;
}

function getSupabaseKeyRole(): string | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const payload = serviceRoleKey?.split('.')[1];

  if (!payload) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { role?: unknown };

    return typeof decoded.role === 'string' ? decoded.role : null;
  } catch {
    return 'unreadable';
  }
}

async function loadOrderByNumber(
  orderNumber: string,
): Promise<ThankYouOrderRow | null> {
  const supabase = createAdminClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  console.log('[thank-you] supabase admin client', {
    supabaseHost: supabaseUrl ? new URL(supabaseUrl).host : null,
    serviceKeyRole: getSupabaseKeyRole(),
  });

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, current_status, payable_until')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    console.error('[thank-you] order query failed', {
      orderNumber,
      error,
    });

    throw error;
  }

  console.log('[thank-you] order query result', {
    orderNumber,
    found: data !== null,
    row: data
      ? {
          id: data.id,
          orderNumber: data.order_number,
          currentStatus: data.current_status,
          payableUntil: data.payable_until,
        }
      : null,
  });

  return data;
}
export async function loadThankYouPageData(
  input: LoadThankYouPageInput,
): Promise<LoadThankYouPageData> {
  const orderNumber = normalizeOrderNumber(input.order);
  const refreshRequested = input.refresh === '1';

  console.log('[thank-you] loader input', {
    rawOrder: input.order,
    normalizedOrderNumber: orderNumber,
    refresh: input.refresh,
    refreshRequested,
  });

  if (orderNumber === null) {
    console.warn('[thank-you] missing order number');

    return {
      orderNumber: null,
      state: resolveCheckoutThankYouState({
        hasOrderAccess: false,
        currentOrderStatus: null,
        payableUntil: null,
      }),
    };
  }

  try {
    const order = await loadOrderByNumber(orderNumber);

    if (order === null) {
      console.warn('[thank-you] order not found or not visible', {
        orderNumber,
      });

      return {
        orderNumber,
        state: resolveCheckoutThankYouState({
          hasOrderAccess: false,
          currentOrderStatus: null,
          payableUntil: null,
        }),
      };
    }

    const currentOrder = refreshRequested
      ? await loadOrderByNumber(orderNumber)
      : order;
    const resolvedOrder = currentOrder ?? order;
    const normalizedStatus = normalizeResolvableOrderStatus(
      resolvedOrder.current_status,
    );
    const state = resolveCheckoutThankYouState({
      hasOrderAccess: true,
      currentOrderStatus: normalizedStatus,
      payableUntil: resolvedOrder.payable_until,
    });

    console.log('[thank-you] resolved order state', {
      orderNumber: resolvedOrder.order_number,
      currentStatus: resolvedOrder.current_status,
      normalizedStatus,
      payableUntil: resolvedOrder.payable_until,
      stateId: state.id,
    });

    return {
      orderNumber: resolvedOrder.order_number,
      state,
    };
  } catch (error) {
    console.error('Failed to load thank-you page data.', {
      orderNumber,
      error,
    });

    return {
      orderNumber,
      state: resolveCheckoutThankYouState({
        hasOrderAccess: false,
        currentOrderStatus: null,
        payableUntil: null,
      }),
    };
  }
}
