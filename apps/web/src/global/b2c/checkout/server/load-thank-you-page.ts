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

async function loadOrderByNumber(
  orderNumber: string,
): Promise<ThankYouOrderRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, current_status, payable_until')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
export async function loadThankYouPageData(
  input: LoadThankYouPageInput,
): Promise<LoadThankYouPageData> {
  const orderNumber = normalizeOrderNumber(input.order);
  const refreshRequested = input.refresh === '1';

  if (orderNumber === null) {
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

    return {
      orderNumber: currentOrder?.order_number ?? order.order_number,
      state: resolveCheckoutThankYouState({
        hasOrderAccess: true,
        currentOrderStatus: normalizeResolvableOrderStatus(
          (currentOrder ?? order).current_status,
        ),
        payableUntil: (currentOrder ?? order).payable_until,
      }),
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
