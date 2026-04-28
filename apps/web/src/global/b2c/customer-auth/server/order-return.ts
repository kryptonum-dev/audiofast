import 'server-only';

import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

type OrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'current_status'
  | 'customer_email'
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

const RETURN_ELIGIBLE_STATUSES = new Set(['shipped', 'completed']);
const RETURN_CASE_SELECT = 'id, status, reason, created_at';
const RETURN_WINDOW_DAYS = 14;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function getInvoiceRecipientType(
  invoiceData: Json | null,
): 'private' | 'company' | 'unknown' {
  if (!isRecord(invoiceData)) {
    return 'private';
  }

  const rawRecipientType = getString(invoiceData.recipientType);
  return rawRecipientType === 'private' || rawRecipientType === 'company'
    ? rawRecipientType
    : 'unknown';
}

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
  if (!RETURN_ELIGIBLE_STATUSES.has(order.current_status)) {
    return 'status';
  }

  if (items.length === 0 || items.some((item) => !item.is_returnable)) {
    return 'non_returnable_item';
  }

  if (getInvoiceRecipientType(order.invoice_data) === 'company') {
    return 'company_invoice';
  }

  const shippedTimestamp = order.shipped_at
    ? Date.parse(order.shipped_at)
    : Number.NaN;
  const returnDeadline = Number.isNaN(shippedTimestamp)
    ? Number.NaN
    : shippedTimestamp + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  if (Number.isNaN(returnDeadline) || now.getTime() > returnDeadline) {
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
    .eq('status', 'open')
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
      'id, order_number, current_status, customer_email, shipped_at, invoice_data',
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

  return {
    kind: 'created',
    returnCase: mapReturnCase(data),
  };
}
