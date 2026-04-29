import 'server-only';

import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';

import type { CheckoutOrderStatus } from '../order-draft';
import {
  type CheckoutThankYouStateDefinition,
  getCheckoutThankYouStateDefinition,
} from './thank-you-state';

type ThankYouOrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  'id' | 'order_number' | 'current_status' | 'payable_until'
>;

type CheckoutThankYouResolvableOrderStatus = Extract<
  CheckoutOrderStatus,
  'awaiting_payment' | 'paid'
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

function getStatusCharCodes(value: string): number[] {
  return Array.from(value).map((character) => character.charCodeAt(0));
}

function isExpired(args: {
  payableUntil: string | null;
  now: string;
}): boolean {
  if (args.payableUntil === null) {
    return false;
  }

  const payableUntilTime = Date.parse(args.payableUntil);
  const nowTime = Date.parse(args.now);

  if (Number.isNaN(payableUntilTime) || Number.isNaN(nowTime)) {
    return false;
  }

  return nowTime > payableUntilTime;
}

function resolveInvalidAccessState(args: {
  reason: string;
  orderNumber: string | null;
  currentStatus?: string | null;
  normalizedStatus?: CheckoutThankYouResolvableOrderStatus | null;
}) {
  console.warn('[thank-you] selected invalid_access state', args);

  return getCheckoutThankYouStateDefinition('invalid_access');
}

function resolvePersistedOrderState(
  order: ThankYouOrderRow,
): CheckoutThankYouStateDefinition {
  const normalizedStatus = normalizeResolvableOrderStatus(order.current_status);
  const now = new Date().toISOString();
  const expired = isExpired({
    payableUntil: order.payable_until,
    now,
  });

  console.log('[thank-you] resolving persisted order state', {
    orderNumber: order.order_number,
    currentStatus: order.current_status,
    currentStatusType: typeof order.current_status,
    currentStatusJson: JSON.stringify(order.current_status),
    currentStatusCharCodes: getStatusCharCodes(order.current_status),
    normalizedStatus,
    isPaidStatus: normalizedStatus === 'paid',
    isAwaitingPaymentStatus: normalizedStatus === 'awaiting_payment',
    payableUntil: order.payable_until,
    now,
    expired,
  });

  if (normalizedStatus === 'paid') {
    console.log('[thank-you] selected paid state', {
      orderNumber: order.order_number,
      currentStatus: order.current_status,
      normalizedStatus,
    });

    return getCheckoutThankYouStateDefinition('paid');
  }

  if (normalizedStatus !== 'awaiting_payment') {
    return resolveInvalidAccessState({
      reason: 'unsupported_order_status',
      orderNumber: order.order_number,
      currentStatus: order.current_status,
      normalizedStatus,
    });
  }

  if (expired) {
    console.warn('[thank-you] selected expired state', {
      orderNumber: order.order_number,
      currentStatus: order.current_status,
      normalizedStatus,
      payableUntil: order.payable_until,
      now,
    });

    return getCheckoutThankYouStateDefinition('expired');
  }

  console.log('[thank-you] selected awaiting_payment state', {
    orderNumber: order.order_number,
    currentStatus: order.current_status,
    normalizedStatus,
    payableUntil: order.payable_until,
    now,
  });

  return getCheckoutThankYouStateDefinition('awaiting_payment');
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
      state: resolveInvalidAccessState({
        reason: 'missing_order_number',
        orderNumber: null,
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
        state: resolveInvalidAccessState({
          reason: 'order_not_found_or_not_visible',
          orderNumber,
        }),
      };
    }

    const currentOrder = refreshRequested
      ? await loadOrderByNumber(orderNumber)
      : order;
    const resolvedOrder = currentOrder ?? order;
    const state = resolvePersistedOrderState(resolvedOrder);

    console.log('[thank-you] resolved order state', {
      orderNumber: resolvedOrder.order_number,
      currentStatus: resolvedOrder.current_status,
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
      state: resolveInvalidAccessState({
        reason: 'loader_exception',
        orderNumber,
      }),
    };
  }
}
