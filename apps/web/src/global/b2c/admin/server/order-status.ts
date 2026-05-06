import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';

import type { VerifiedAdminOperator } from '@/src/global/b2c/admin/server/auth';
import {
  type B2cOrderStatus,
  getAdminAllowedNextOrderStatusesForOrder,
  isB2cOrderStatus,
} from '@/src/global/b2c/utils/statuses';
import { normalizeOptionalText } from '@/src/global/b2c/utils/text';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

import {
  getAdminOrderStatusEmailStatus,
  sendAdminOrderStatusUpdateEmail,
} from './order-status-email';

export type AdminOrderStatusRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'cancelled_at'
  | 'completed_at'
  | 'created_at'
  | 'current_status'
  | 'customer_email'
  | 'customer_snapshot'
  | 'id'
  | 'order_number'
  | 'paid_at'
  | 'returned_at'
  | 'shipment_data'
  | 'shipped_at'
  | 'status_history'
  | 'updated_at'
>;

type OrdersUpdate = Database['public']['Tables']['orders']['Update'];

export type AdminOrderStatusTransitionInput = {
  note?: string | null;
  status: string;
};

export type AdminOrderStatusTransitionResult = {
  orderId: string;
  orderNumber: string;
  previousStatus: string;
  currentStatus: string;
  changedAt: string;
  statusHistory: Json;
  timestamps: {
    paidAt: string | null;
    shippedAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    returnedAt: string | null;
  };
  customerEmail: {
    attempted: boolean;
    required: boolean;
    status: 'sent' | 'failed' | 'not_required';
  };
};

export class AdminOrderStatusError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid_status_payload'
      | 'invalid_status_transition'
      | 'order_not_found'
      | 'database_error',
    public readonly status: number,
    public readonly causeError: PostgrestError | Error | null = null,
  ) {
    super(message);
    this.name = 'AdminOrderStatusError';
  }
}

function normalizeAdminOrderStatus(value: string): B2cOrderStatus {
  const normalized = value.trim();

  if (!isB2cOrderStatus(normalized)) {
    throw new AdminOrderStatusError(
      `Unsupported admin order status: ${value}.`,
      'invalid_status_payload',
      400,
    );
  }

  return normalized;
}

function normalizeStatusHistory(value: Json): Json[] {
  return Array.isArray(value) ? value : [];
}

export function buildAdminStatusHistoryEntry(args: {
  actor: VerifiedAdminOperator;
  changedAt: string;
  nextStatus: B2cOrderStatus;
  note: string | null;
  previousStatus: string;
}): Record<string, Json> {
  return {
    actorEmail: args.actor.email,
    actorId: args.actor.id,
    actorImage: args.actor.profileImage,
    actorName: args.actor.name,
    changedAt: args.changedAt,
    note: args.note,
    previousStatus: args.previousStatus,
    source: 'admin',
    status: args.nextStatus,
  };
}

export function buildAdminOrderStatusUpdatePayload(args: {
  actor: VerifiedAdminOperator;
  changedAt: string;
  currentStatus: string;
  nextStatus: B2cOrderStatus;
  note: string | null;
  shippedAt: string | null;
  statusHistory: Json;
}): OrdersUpdate {
  const allowedNextStatuses = getAdminAllowedNextOrderStatusesForOrder({
    currentStatus: args.currentStatus,
    now: new Date(args.changedAt),
    shippedAt: args.shippedAt,
  });

  if (!allowedNextStatuses.includes(args.nextStatus)) {
    throw new AdminOrderStatusError(
      `Cannot move order from ${args.currentStatus} to ${args.nextStatus}.`,
      'invalid_status_transition',
      409,
    );
  }

  const history = normalizeStatusHistory(args.statusHistory);
  const payload: OrdersUpdate = {
    current_status: args.nextStatus,
    status_history: [
      ...history,
      buildAdminStatusHistoryEntry({
        actor: args.actor,
        changedAt: args.changedAt,
        nextStatus: args.nextStatus,
        note: args.note,
        previousStatus: args.currentStatus,
      }),
    ],
    updated_at: args.changedAt,
  };

  switch (args.nextStatus) {
    case 'shipped':
      payload.shipped_at = args.changedAt;
      break;
    case 'completed':
      payload.completed_at = args.changedAt;
      break;
    case 'cancelled':
      payload.cancelled_at = args.changedAt;
      break;
    case 'returned':
      payload.returned_at = args.changedAt;
      break;
  }

  return payload;
}

async function loadOrderStatusRow(
  orderNumber: string,
): Promise<AdminOrderStatusRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      'cancelled_at, completed_at, created_at, current_status, customer_email, customer_snapshot, id, order_number, paid_at, returned_at, shipment_data, shipped_at, status_history, updated_at',
    )
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    throw new AdminOrderStatusError(
      'Failed to load the B2C order before status update.',
      'database_error',
      500,
      error,
    );
  }

  if (!data) {
    throw new AdminOrderStatusError(
      'The requested B2C order could not be found.',
      'order_not_found',
      404,
    );
  }

  return data as AdminOrderStatusRow;
}

async function updateOrderStatus(args: {
  expectedCurrentStatus: string;
  orderId: string;
  payload: OrdersUpdate;
}): Promise<AdminOrderStatusRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .update(args.payload)
    .eq('id', args.orderId)
    .eq('current_status', args.expectedCurrentStatus)
    .select(
      'cancelled_at, completed_at, created_at, current_status, customer_email, customer_snapshot, id, order_number, paid_at, returned_at, shipment_data, shipped_at, status_history, updated_at',
    )
    .single();

  if (!error && data) {
    return data as AdminOrderStatusRow;
  }

  if (error && error.code !== 'PGRST116') {
    throw new AdminOrderStatusError(
      'Failed to update the B2C order status.',
      'database_error',
      500,
      error,
    );
  }

  return null;
}

export function mapAdminOrderStatusTransitionResult(args: {
  changedAt: string;
  emailStatus: AdminOrderStatusTransitionResult['customerEmail'];
  previousStatus: string;
  row: AdminOrderStatusRow;
}): AdminOrderStatusTransitionResult {
  return {
    orderId: args.row.id,
    orderNumber: args.row.order_number,
    previousStatus: args.previousStatus,
    currentStatus: args.row.current_status,
    changedAt: args.changedAt,
    statusHistory: args.row.status_history,
    timestamps: {
      paidAt: args.row.paid_at,
      shippedAt: args.row.shipped_at,
      completedAt: args.row.completed_at,
      cancelledAt: args.row.cancelled_at,
      returnedAt: args.row.returned_at,
    },
    customerEmail: args.emailStatus,
  };
}

export async function sendAdminOrderStatusCustomerEmail(args: {
  row: AdminOrderStatusRow;
}): Promise<AdminOrderStatusTransitionResult['customerEmail']> {
  const status = getAdminOrderStatusEmailStatus(args.row.current_status);

  if (!status) {
    return {
      attempted: false,
      required: false,
      status: 'not_required',
    };
  }

  try {
    await sendAdminOrderStatusUpdateEmail({
      order: args.row,
      status,
    });

    return {
      attempted: true,
      required: true,
      status: 'sent',
    };
  } catch (error) {
    console.error('Failed to send B2C admin order status email.', {
      currentStatus: args.row.current_status,
      error,
      orderId: args.row.id,
      orderNumber: args.row.order_number,
    });

    return {
      attempted: true,
      required: true,
      status: 'failed',
    };
  }
}

export async function updateAdminOrderStatus(args: {
  actor: VerifiedAdminOperator;
  input: AdminOrderStatusTransitionInput;
  now?: Date;
  orderNumber: string;
}): Promise<AdminOrderStatusTransitionResult> {
  const changedAt = (args.now ?? new Date()).toISOString();
  const nextStatus = normalizeAdminOrderStatus(args.input.status);
  const note = normalizeOptionalText(args.input.note);
  const currentRow = await loadOrderStatusRow(args.orderNumber);
  const previousStatus = currentRow.current_status;
  const payload = buildAdminOrderStatusUpdatePayload({
    actor: args.actor,
    changedAt,
    currentStatus: currentRow.current_status,
    nextStatus,
    note,
    shippedAt: currentRow.shipped_at,
    statusHistory: currentRow.status_history,
  });
  const updatedRow = await updateOrderStatus({
    expectedCurrentStatus: currentRow.current_status,
    orderId: currentRow.id,
    payload,
  });

  if (!updatedRow) {
    throw new AdminOrderStatusError(
      'The order status changed before the admin update could be applied.',
      'invalid_status_transition',
      409,
    );
  }

  const emailStatus = await sendAdminOrderStatusCustomerEmail({
    row: updatedRow,
  });

  return mapAdminOrderStatusTransitionResult({
    changedAt,
    emailStatus,
    previousStatus,
    row: updatedRow,
  });
}
