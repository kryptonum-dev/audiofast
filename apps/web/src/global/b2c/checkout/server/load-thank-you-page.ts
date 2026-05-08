import 'server-only';

import type {
  CommerceOrderItemAnalyticsPayload,
  CommercePurchaseAnalyticsPayload,
} from '@/src/global/b2c/analytics/commerce-events';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

import type { CheckoutOrderStatus } from '../order-draft';
import {
  type CheckoutThankYouStateDefinition,
  getCheckoutThankYouStateDefinition,
} from './thank-you-state';

type ThankYouOrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'id'
  | 'order_number'
  | 'current_status'
  | 'payable_until'
  | 'customer_email'
  | 'customer_profile_id'
  | 'customer_snapshot'
  | 'shipping_address_snapshot'
  | 'subtotal_cents'
  | 'discount_total_cents'
  | 'grand_total_cents'
  | 'used_discount'
>;

type ThankYouOrderItemRow = Database['public']['Tables']['order_items']['Row'];

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
  analytics: CommercePurchaseAnalyticsPayload | null;
};

function normalizeOrderNumber(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: Json): value is Record<string, Json | undefined> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getStringField(value: Json, key: string): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const field = value[key];

  return typeof field === 'string' && field.trim().length > 0 ? field : null;
}

function getCouponCode(value: Json | null): string | null {
  return value ? getStringField(value, 'couponCode') : null;
}

function mapOrderItemAnalytics(
  item: ThankYouOrderItemRow,
): CommerceOrderItemAnalyticsPayload {
  return {
    lineType: item.line_type === 'cpo' ? 'cpo' : 'standard',
    productKey: item.product_key,
    productName: item.product_name,
    brandName: item.brand_name,
    quantity: item.quantity,
    unitPriceCents: item.unit_price_cents,
    lineDiscountTotalCents: item.line_discount_total_cents,
    lineTotalCents: item.line_total_cents,
  };
}

function buildPurchaseAnalyticsPayload(args: {
  order: ThankYouOrderRow;
  items: ThankYouOrderItemRow[];
}): CommercePurchaseAnalyticsPayload {
  return {
    orderId: args.order.id,
    orderNumber: args.order.order_number,
    customerEmail: args.order.customer_email,
    customerProfileId: args.order.customer_profile_id,
    customer: {
      firstName: getStringField(args.order.customer_snapshot, 'firstName'),
      lastName: getStringField(args.order.customer_snapshot, 'lastName'),
      phone: getStringField(args.order.customer_snapshot, 'phone'),
    },
    shippingAddress: {
      city: getStringField(args.order.shipping_address_snapshot, 'city'),
      postalCode: getStringField(
        args.order.shipping_address_snapshot,
        'postalCode',
      ),
      country: getStringField(args.order.shipping_address_snapshot, 'country'),
    },
    subtotalCents: args.order.subtotal_cents,
    discountTotalCents: args.order.discount_total_cents,
    grandTotalCents: args.order.grand_total_cents,
    couponCode: getCouponCode(args.order.used_discount),
    items: args.items.map(mapOrderItemAnalytics),
  };
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
    .select(
      'id, order_number, current_status, payable_until, customer_email, customer_profile_id, customer_snapshot, shipping_address_snapshot, subtotal_cents, discount_total_cents, grand_total_cents, used_discount',
    )
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

async function loadOrderItems(
  orderId: string,
): Promise<ThankYouOrderItemRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('line_position', { ascending: true });

  if (error) {
    console.error('[thank-you] order items query failed', {
      orderId,
      error,
    });

    throw error;
  }

  return data ?? [];
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
      analytics: null,
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
        analytics: null,
      };
    }

    const currentOrder = refreshRequested
      ? await loadOrderByNumber(orderNumber)
      : order;
    const resolvedOrder = currentOrder ?? order;
    const state = resolvePersistedOrderState(resolvedOrder);
    const analytics =
      state.id === 'paid'
        ? buildPurchaseAnalyticsPayload({
            order: resolvedOrder,
            items: await loadOrderItems(resolvedOrder.id),
          })
        : null;

    console.log('[thank-you] resolved order state', {
      orderNumber: resolvedOrder.order_number,
      currentStatus: resolvedOrder.current_status,
      payableUntil: resolvedOrder.payable_until,
      stateId: state.id,
    });

    return {
      orderNumber: resolvedOrder.order_number,
      state,
      analytics,
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
      analytics: null,
    };
  }
}
