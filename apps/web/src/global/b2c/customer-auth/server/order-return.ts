import 'server-only';

import { sendReturnRequestAcknowledgmentEmail } from '@/src/global/b2c/return-emails';
import { getOrderInvoiceRecipientType } from '@/src/global/b2c/utils/orders';
import {
  isReturnEligibleOrderStatus,
  isWithinReturnWindow,
} from '@/src/global/b2c/utils/statuses';
import { normalizeOptionalText } from '@/src/global/b2c/utils/text';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

type OrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'current_status'
  | 'customer_email'
  | 'customer_snapshot'
  | 'id'
  | 'invoice_data'
  | 'order_number'
  | 'shipped_at'
>;
type ReturnCaseRow = Database['public']['Tables']['return_cases']['Row'];
type OrderItemReturnabilityRow = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'is_returnable'
>;

export type CustomerOrderReturnCaseSummary = {
  id: string;
  status: string;
  reason: string | null;
  createdAt: string;
};

export type CustomerOrderReturnIneligibilityReason =
  | 'status'
  | 'non_returnable_item'
  | 'company_invoice'
  | 'return_window_expired';

export type RequestCustomerOrderReturnInput = {
  orderNumber: string;
  normalizedEmail: string;
  reason?: string | null;
  now?: Date;
};

export type RequestCustomerOrderReturnResult =
  | {
      kind: 'created';
      returnCase: CustomerOrderReturnCaseSummary;
    }
  | {
      kind: 'already_requested';
      returnCase: CustomerOrderReturnCaseSummary;
    }
  | {
      kind: 'not_eligible';
      currentStatus: string;
      reason: CustomerOrderReturnIneligibilityReason;
    }
  | {
      kind: 'not_found';
    };

const RETURN_CASE_SELECT = 'id, status, reason, created_at';
const ACTIVE_RETURN_CASE_STATUSES = ['open', 'awaiting_goods'];

function mapReturnCase(
  returnCase: Pick<ReturnCaseRow, 'created_at' | 'id' | 'reason' | 'status'>,
): CustomerOrderReturnCaseSummary {
  return {
    createdAt: returnCase.created_at,
    id: returnCase.id,
    reason: returnCase.reason,
    status: returnCase.status,
  };
}

function getReturnIneligibilityReason({
  items,
  now,
  order,
}: {
  items: OrderItemReturnabilityRow[];
  now: Date;
  order: OrderRow;
}): CustomerOrderReturnIneligibilityReason | null {
  if (!isReturnEligibleOrderStatus(order.current_status)) {
    return 'status';
  }

  if (items.length === 0 || items.some((item) => !item.is_returnable)) {
    return 'non_returnable_item';
  }

  if (getOrderInvoiceRecipientType(order.invoice_data) === 'company') {
    return 'company_invoice';
  }

  if (!isWithinReturnWindow({ now, shippedAt: order.shipped_at })) {
    return 'return_window_expired';
  }

  return null;
}

async function loadOpenReturnCase(
  orderId: string,
): Promise<CustomerOrderReturnCaseSummary | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('return_cases')
    .select(RETURN_CASE_SELECT)
    .eq('order_id', orderId)
    .in('status', ACTIVE_RETURN_CASE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapReturnCase(data) : null;
}

async function loadOwnedOrder({
  normalizedEmail,
  orderNumber,
}: Pick<
  RequestCustomerOrderReturnInput,
  'normalizedEmail' | 'orderNumber'
>): Promise<OrderRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, current_status, customer_email, customer_snapshot, shipped_at, invoice_data',
    )
    .eq('order_number', orderNumber)
    .ilike('customer_email', normalizedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function loadOrderReturnability(
  orderId: string,
): Promise<OrderItemReturnabilityRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_items')
    .select('is_returnable')
    .eq('order_id', orderId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

function getCustomerFirstName(snapshot: Json): string {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return 'Kliencie';
  }

  const firstName = snapshot.firstName;

  return typeof firstName === 'string' && firstName.trim()
    ? firstName.trim()
    : 'Kliencie';
}

async function markReturnAcknowledgmentSent(
  returnCaseId: string,
  sentAt: string,
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('return_cases')
    .update({
      acknowledgment_sent_at: sentAt,
      updated_at: sentAt,
    })
    .eq('id', returnCaseId);

  if (error) {
    throw error;
  }
}

export async function requestCustomerOrderReturn({
  normalizedEmail,
  now = new Date(),
  orderNumber,
  reason,
}: RequestCustomerOrderReturnInput): Promise<RequestCustomerOrderReturnResult> {
  const order = await loadOwnedOrder({ normalizedEmail, orderNumber });
  const normalizedReason = normalizeOptionalText(reason);

  if (!order) {
    return { kind: 'not_found' };
  }

  const [existingReturnCase, items] = await Promise.all([
    loadOpenReturnCase(order.id),
    loadOrderReturnability(order.id),
  ]);

  if (existingReturnCase) {
    return {
      kind: 'already_requested',
      returnCase: existingReturnCase,
    };
  }

  const ineligibilityReason = getReturnIneligibilityReason({
    items,
    now,
    order,
  });

  if (ineligibilityReason) {
    return {
      kind: 'not_eligible',
      currentStatus: order.current_status,
      reason: ineligibilityReason,
    };
  }

  const createdAt = now.toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('return_cases')
    .insert({
      created_at: createdAt,
      order_id: order.id,
      reason: normalizedReason,
      status: 'open',
      updated_at: createdAt,
    })
    .select(RETURN_CASE_SELECT)
    .single();

  if (error) {
    if (error.code === '23505') {
      const duplicateReturnCase = await loadOpenReturnCase(order.id);

      if (duplicateReturnCase) {
        return {
          kind: 'already_requested',
          returnCase: duplicateReturnCase,
        };
      }
    }

    throw error;
  }

  const returnCase = mapReturnCase(data);

  try {
    const emailResult = await sendReturnRequestAcknowledgmentEmail({
      customerEmail: order.customer_email,
      customerFirstName: getCustomerFirstName(order.customer_snapshot),
      orderNumber: order.order_number,
    });

    if (emailResult.success) {
      await markReturnAcknowledgmentSent(
        returnCase.id,
        new Date().toISOString(),
      );
    } else {
      console.error(
        '[B2C Returns] Failed to send return request acknowledgment email.',
        emailResult.error,
      );
    }
  } catch (error) {
    console.error(
      '[B2C Returns] Failed to send return request acknowledgment email.',
      error,
    );
  }

  return {
    kind: 'created',
    returnCase,
  };
}
