import 'server-only';

import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';

import type { MockP24ScenarioId } from '../mock-payment-scenarios';
import { buildMockP24StatusNotificationPayloadForOrder } from './payment-mock';
import { getMockP24Scenario } from './payment-mock-scenarios';
import { handleCheckoutPaymentStatusNotification } from './payment-status';
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
  scenario?: string;
  refresh?: string;
};

export type LoadThankYouPageData = {
  orderNumber: string | null;
  mockScenarioId: MockP24ScenarioId | null;
  state: CheckoutThankYouStateDefinition;
};

function normalizeOrderNumber(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeScenarioId(
  value: string | undefined,
): MockP24ScenarioId | null {
  switch (value) {
    case 'success_status_before_return':
    case 'success_return_before_status':
      return value;
    default:
      return null;
  }
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

function shouldAdvanceScenarioAfterReturn(args: {
  scenarioId: MockP24ScenarioId | null;
  refreshRequested: boolean;
}): boolean {
  if (!args.refreshRequested || args.scenarioId === null) {
    return false;
  }

  const scenario = getMockP24Scenario(args.scenarioId);

  return scenario.eventOrder === 'return_before_status';
}

async function maybeAdvanceMockScenarioAfterReturn(args: {
  order: ThankYouOrderRow;
  scenarioId: MockP24ScenarioId | null;
  refreshRequested: boolean;
}) {
  if (args.order.current_status === 'paid') {
    return;
  }

  if (
    !shouldAdvanceScenarioAfterReturn({
      scenarioId: args.scenarioId,
      refreshRequested: args.refreshRequested,
    })
  ) {
    return;
  }

  const notification = buildMockP24StatusNotificationPayloadForOrder({
    checkoutOrderId: args.order.id,
    orderNumber: args.order.order_number,
    scenarioId: args.scenarioId,
  });

  if (notification === null) {
    return;
  }

  await handleCheckoutPaymentStatusNotification({
    notification,
  });
}

export async function loadThankYouPageData(
  input: LoadThankYouPageInput,
): Promise<LoadThankYouPageData> {
  const orderNumber = normalizeOrderNumber(input.order);
  const mockScenarioId = normalizeScenarioId(input.scenario);
  const refreshRequested = input.refresh === '1';

  if (orderNumber === null) {
    return {
      orderNumber: null,
      mockScenarioId,
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
        mockScenarioId,
        state: resolveCheckoutThankYouState({
          hasOrderAccess: false,
          currentOrderStatus: null,
          payableUntil: null,
        }),
      };
    }

    await maybeAdvanceMockScenarioAfterReturn({
      order,
      scenarioId: mockScenarioId,
      refreshRequested,
    });
    const currentOrder = refreshRequested
      ? await loadOrderByNumber(orderNumber)
      : order;

    return {
      orderNumber: currentOrder?.order_number ?? order.order_number,
      mockScenarioId,
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
      mockScenarioId,
      state: resolveCheckoutThankYouState({
        hasOrderAccess: false,
        currentOrderStatus: null,
        payableUntil: null,
      }),
    };
  }
}
