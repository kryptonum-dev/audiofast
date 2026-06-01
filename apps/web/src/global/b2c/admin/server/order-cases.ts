import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';

import type { VerifiedAdminOperator } from '@/src/global/b2c/admin/server/auth';
import {
  type AdminOrderStatusRow,
  type AdminOrderStatusTransitionResult,
  mapAdminOrderStatusTransitionResult,
  sendAdminOrderStatusCustomerEmail,
} from '@/src/global/b2c/admin/server/order-status';
import {
  getOrderInvoiceRecipientType,
  isRecord,
} from '@/src/global/b2c/utils/orders';
import {
  isReturnEligibleOrderStatus,
  isWithinReturnWindow,
} from '@/src/global/b2c/utils/statuses';
import { normalizeOptionalText } from '@/src/global/b2c/utils/text';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

type OrderCaseRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'current_status'
  | 'customer_email'
  | 'customer_snapshot'
  | 'id'
  | 'invoice_data'
  | 'order_number'
  | 'shipped_at'
>;
type CancellationRequestRow =
  Database['public']['Tables']['order_cancellation_requests']['Row'];
type ReturnCaseRow = Database['public']['Tables']['return_cases']['Row'];
type OrderItemReturnabilityRow = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'is_returnable'
>;
type AtomicCaseMutationResult = {
  order: AdminOrderStatusRow;
  previousStatus: string;
  request?: CancellationRequestRow;
  returnCase?: ReturnCaseRow;
};
const ACTIVE_RETURN_CASE_STATUSES = ['open', 'awaiting_goods'];

export type AdminCancellationResolution = 'cancel_order' | 'decline_request';

export type AdminCancellationResolveInput = {
  adminNote?: string | null;
  requestId?: string | null;
  resolution?: string | null;
};

export type AdminReturnCaseInput = {
  adminNote?: string | null;
  reason?: string | null;
};

export type AdminCancellationResolveResult = {
  orderId: string;
  orderNumber: string;
  cancellationRequest: AdminCancellationRequestSummary;
  orderStatus: AdminOrderStatusTransitionResult | null;
};

export type AdminReturnCaseSummary = {
  id: string;
  status: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  awaitingGoodsAt: string | null;
  acknowledgmentSentAt: string | null;
  instructionsSentAt: string | null;
  closedAt: string | null;
  completedAt: string | null;
};

export type AdminCancellationRequestSummary = {
  id: string;
  status: string;
  reason: string | null;
  customerMessage: string | null;
  adminNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

export type AdminReturnCaseResult = {
  orderId: string;
  orderNumber: string;
  returnCase: AdminReturnCaseSummary;
  orderStatus: AdminOrderStatusTransitionResult | null;
  customerEmail?: {
    attempted: boolean;
    status: 'sent' | 'failed' | 'not_required';
  };
};

export class AdminOrderCaseError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid_cancellation_payload'
      | 'invalid_return_payload'
      | 'order_not_found'
      | 'cancellation_request_not_found'
      | 'return_case_not_found'
      | 'cancellation_not_eligible'
      | 'return_not_eligible'
      | 'case_not_open'
      | 'database_error',
    public readonly status: number,
    public readonly causeError: PostgrestError | Error | null = null,
  ) {
    super(message);
    this.name = 'AdminOrderCaseError';
  }
}

function normalizeCancellationResolution(
  value: string | null | undefined,
): AdminCancellationResolution {
  if (value === 'cancel_order' || value === 'decline_request') {
    return value;
  }

  throw new AdminOrderCaseError(
    'resolution must be cancel_order or decline_request.',
    'invalid_cancellation_payload',
    400,
  );
}

function mapCancellationRequest(
  row: CancellationRequestRow,
): AdminCancellationRequestSummary {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    customerMessage: row.customer_message,
    adminNote: row.admin_note,
    requestedAt: row.requested_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  };
}

function mapReturnCase(row: ReturnCaseRow): AdminReturnCaseSummary {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    awaitingGoodsAt: row.awaiting_goods_at,
    acknowledgmentSentAt: row.acknowledgment_sent_at,
    instructionsSentAt: row.instructions_sent_at,
    closedAt: row.closed_at,
    completedAt: row.completed_at,
  };
}

function getAtomicCaseMutationError(error: string): {
  code: AdminOrderCaseError['code'];
  message: string;
  status: number;
} {
  switch (error) {
    case 'order_not_found':
      return {
        code: 'order_not_found',
        message: 'The requested B2C order could not be found.',
        status: 404,
      };
    case 'cancellation_request_not_found':
      return {
        code: 'cancellation_request_not_found',
        message:
          'The requested cancellation request could not be found for this order.',
        status: 404,
      };
    case 'return_case_not_found':
      return {
        code: 'return_case_not_found',
        message: 'The requested return case could not be found for this order.',
        status: 404,
      };
    case 'case_not_open':
      return {
        code: 'case_not_open',
        message: 'This case is not in the expected state for this operation.',
        status: 409,
      };
    case 'cancellation_not_eligible':
      return {
        code: 'cancellation_not_eligible',
        message: 'This order status is not eligible for cancellation.',
        status: 409,
      };
    case 'return_not_eligible':
      return {
        code: 'return_not_eligible',
        message:
          'Only shipped or completed orders can be completed as returned.',
        status: 409,
      };
    default:
      return {
        code: 'database_error',
        message: 'The atomic B2C admin case mutation failed.',
        status: 500,
      };
  }
}

function throwAtomicCaseMutationError(error: string): never {
  const mapped = getAtomicCaseMutationError(error);

  throw new AdminOrderCaseError(mapped.message, mapped.code, mapped.status);
}

function parseAtomicCaseMutationResult(
  value: Json,
  expectedCaseKey: 'cancellationRequest' | 'returnCase',
): AtomicCaseMutationResult {
  if (!isRecord(value)) {
    throwAtomicCaseMutationError('database_error');
  }

  if (value.ok !== true) {
    throwAtomicCaseMutationError(
      typeof value.error === 'string' ? value.error : 'database_error',
    );
  }

  if (
    !isRecord(value.order) ||
    typeof value.previousStatus !== 'string' ||
    !isRecord(value[expectedCaseKey])
  ) {
    throwAtomicCaseMutationError('database_error');
  }

  return {
    order: value.order as unknown as AdminOrderStatusRow,
    previousStatus: value.previousStatus,
    request:
      expectedCaseKey === 'cancellationRequest'
        ? (value[expectedCaseKey] as unknown as CancellationRequestRow)
        : undefined,
    returnCase:
      expectedCaseKey === 'returnCase'
        ? (value[expectedCaseKey] as unknown as ReturnCaseRow)
        : undefined,
  };
}

function buildActorPayload(actor: VerifiedAdminOperator): Json {
  return {
    email: actor.email,
    id: actor.id,
    name: actor.name,
  };
}

function getCancellationResolvedBy(): null {
  return null;
}

async function buildOrderStatusResultFromAtomicMutation(args: {
  changedAt: string;
  order: AdminOrderStatusRow;
  previousStatus: string;
}): Promise<AdminOrderStatusTransitionResult> {
  const emailStatus = await sendAdminOrderStatusCustomerEmail({
    row: args.order,
  });

  return mapAdminOrderStatusTransitionResult({
    changedAt: args.changedAt,
    emailStatus,
    previousStatus: args.previousStatus,
    row: args.order,
  });
}

async function acceptCancellationRequestAtomically(args: {
  actor: VerifiedAdminOperator;
  adminNote: string | null;
  orderNumber: string;
  requestId: string;
  resolvedAt: string;
}): Promise<AtomicCaseMutationResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    'admin_accept_order_cancellation',
    {
      p_actor: buildActorPayload(args.actor),
      p_admin_note: args.adminNote,
      p_order_number: args.orderNumber,
      p_request_id: args.requestId,
      p_resolved_at: args.resolvedAt,
      p_resolved_by: getCancellationResolvedBy(),
    },
  );

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to atomically accept the B2C cancellation request.',
      'database_error',
      500,
      error,
    );
  }

  return parseAtomicCaseMutationResult(data, 'cancellationRequest');
}

async function completeReturnCaseAtomically(args: {
  actor: VerifiedAdminOperator;
  adminNote: string | null;
  completedAt: string;
  orderNumber: string;
  returnCaseId: string;
}): Promise<AtomicCaseMutationResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    'admin_complete_order_return_case',
    {
      p_actor: buildActorPayload(args.actor),
      p_admin_note: args.adminNote,
      p_completed_at: args.completedAt,
      p_order_number: args.orderNumber,
      p_return_case_id: args.returnCaseId,
    },
  );

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to atomically complete the B2C return case.',
      'database_error',
      500,
      error,
    );
  }

  return parseAtomicCaseMutationResult(data, 'returnCase');
}

async function markReturnCaseAwaitingGoodsAtomically(args: {
  awaitingGoodsAt: string;
  orderNumber: string;
  returnCaseId: string;
}): Promise<ReturnCaseRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    'admin_mark_return_case_awaiting_goods',
    {
      p_awaiting_goods_at: args.awaitingGoodsAt,
      p_order_number: args.orderNumber,
      p_return_case_id: args.returnCaseId,
    },
  );

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to mark the B2C return case as awaiting goods.',
      'database_error',
      500,
      error,
    );
  }

  if (!isRecord(data)) {
    throwAtomicCaseMutationError('database_error');
  }

  if (data.ok !== true) {
    throwAtomicCaseMutationError(
      typeof data.error === 'string' ? data.error : 'database_error',
    );
  }

  if (!isRecord(data.returnCase)) {
    throwAtomicCaseMutationError('database_error');
  }

  return data.returnCase as unknown as ReturnCaseRow;
}

export function getAdminReturnIneligibilityReason(args: {
  hasOpenReturnCase: boolean;
  itemRows: OrderItemReturnabilityRow[];
  now: Date;
  order: Pick<OrderCaseRow, 'current_status' | 'invoice_data' | 'shipped_at'>;
}):
  | 'status'
  | 'non_returnable_item'
  | 'company_invoice'
  | 'return_window_expired'
  | 'open_return_case'
  | null {
  if (!isReturnEligibleOrderStatus(args.order.current_status)) {
    return 'status';
  }

  if (
    args.itemRows.length === 0 ||
    args.itemRows.some((item) => !item.is_returnable)
  ) {
    return 'non_returnable_item';
  }

  if (getOrderInvoiceRecipientType(args.order.invoice_data) === 'company') {
    return 'company_invoice';
  }

  if (
    !isWithinReturnWindow({ now: args.now, shippedAt: args.order.shipped_at })
  ) {
    return 'return_window_expired';
  }

  if (args.hasOpenReturnCase) {
    return 'open_return_case';
  }

  return null;
}

async function loadOrderCaseRow(orderNumber: string): Promise<OrderCaseRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      'current_status, customer_email, customer_snapshot, id, invoice_data, order_number, shipped_at',
    )
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to load the B2C order.',
      'database_error',
      500,
      error,
    );
  }

  if (!data) {
    throw new AdminOrderCaseError(
      'The requested B2C order could not be found.',
      'order_not_found',
      404,
    );
  }

  return data as OrderCaseRow;
}

async function loadCancellationRequest(args: {
  orderId: string;
  requestId: string;
}): Promise<CancellationRequestRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_cancellation_requests')
    .select(
      'admin_note, created_at, customer_email, customer_message, id, order_id, reason, requested_at, resolved_at, resolved_by, status, updated_at',
    )
    .eq('id', args.requestId)
    .eq('order_id', args.orderId)
    .maybeSingle();

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to load the B2C cancellation request.',
      'database_error',
      500,
      error,
    );
  }

  if (!data) {
    throw new AdminOrderCaseError(
      'The requested cancellation request could not be found for this order.',
      'cancellation_request_not_found',
      404,
    );
  }

  return data as CancellationRequestRow;
}

async function resolveCancellationRequest(args: {
  adminNote: string | null;
  requestId: string;
  resolvedAt: string;
  resolvedBy: string | null;
  status: 'accepted' | 'rejected';
}): Promise<CancellationRequestRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_cancellation_requests')
    .update({
      admin_note: args.adminNote,
      resolved_at: args.resolvedAt,
      resolved_by: args.resolvedBy,
      status: args.status,
      updated_at: args.resolvedAt,
    })
    .eq('id', args.requestId)
    .select(
      'admin_note, created_at, customer_email, customer_message, id, order_id, reason, requested_at, resolved_at, resolved_by, status, updated_at',
    )
    .single();

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to resolve the B2C cancellation request.',
      'database_error',
      500,
      error,
    );
  }

  return data as CancellationRequestRow;
}

async function loadOrderItems(
  orderId: string,
): Promise<OrderItemReturnabilityRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_items')
    .select('is_returnable')
    .eq('order_id', orderId);

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to load B2C order items for return validation.',
      'database_error',
      500,
      error,
    );
  }

  return (data ?? []) as OrderItemReturnabilityRow[];
}

async function loadOpenReturnCase(
  orderId: string,
): Promise<ReturnCaseRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('return_cases')
    .select(
      'acknowledgment_sent_at, awaiting_goods_at, closed_at, completed_at, created_at, id, instructions_sent_at, order_id, reason, status, updated_at',
    )
    .eq('order_id', orderId)
    .in('status', ACTIVE_RETURN_CASE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to load the open B2C return case.',
      'database_error',
      500,
      error,
    );
  }

  return data ? (data as ReturnCaseRow) : null;
}

async function loadReturnCase(args: {
  orderId: string;
  returnCaseId: string;
}): Promise<ReturnCaseRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('return_cases')
    .select(
      'acknowledgment_sent_at, awaiting_goods_at, closed_at, completed_at, created_at, id, instructions_sent_at, order_id, reason, status, updated_at',
    )
    .eq('id', args.returnCaseId)
    .eq('order_id', args.orderId)
    .maybeSingle();

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to load the B2C return case.',
      'database_error',
      500,
      error,
    );
  }

  if (!data) {
    throw new AdminOrderCaseError(
      'The requested return case could not be found for this order.',
      'return_case_not_found',
      404,
    );
  }

  return data as ReturnCaseRow;
}

async function createReturnCase(args: {
  createdAt: string;
  orderId: string;
  reason: string | null;
}): Promise<ReturnCaseRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('return_cases')
    .insert({
      created_at: args.createdAt,
      order_id: args.orderId,
      reason: args.reason,
      status: 'open',
      updated_at: args.createdAt,
    })
    .select(
      'acknowledgment_sent_at, awaiting_goods_at, closed_at, completed_at, created_at, id, instructions_sent_at, order_id, reason, status, updated_at',
    )
    .single();

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to create the B2C return case.',
      'database_error',
      500,
      error,
    );
  }

  return data as ReturnCaseRow;
}

async function updateReturnCase(args: {
  at: string;
  returnCaseId: string;
  status: 'closed_without_return' | 'completed';
}): Promise<ReturnCaseRow> {
  const update =
    args.status === 'completed'
      ? {
          completed_at: args.at,
          status: args.status,
          updated_at: args.at,
        }
      : {
          closed_at: args.at,
          status: args.status,
          updated_at: args.at,
        };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('return_cases')
    .update(update)
    .eq('id', args.returnCaseId)
    .select(
      'acknowledgment_sent_at, awaiting_goods_at, closed_at, completed_at, created_at, id, instructions_sent_at, order_id, reason, status, updated_at',
    )
    .single();

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to update the B2C return case.',
      'database_error',
      500,
      error,
    );
  }

  return data as ReturnCaseRow;
}

function getCustomerFirstName(snapshot: Json): string {
  if (!isRecord(snapshot)) {
    return 'Kliencie';
  }

  const firstName = snapshot.firstName;

  return typeof firstName === 'string' && firstName.trim()
    ? firstName.trim()
    : 'Kliencie';
}

async function markReturnInstructionsSent(
  returnCaseId: string,
  sentAt: string,
): Promise<ReturnCaseRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('return_cases')
    .update({
      instructions_sent_at: sentAt,
      updated_at: sentAt,
    })
    .eq('id', returnCaseId)
    .select(
      'acknowledgment_sent_at, awaiting_goods_at, closed_at, completed_at, created_at, id, instructions_sent_at, order_id, reason, status, updated_at',
    )
    .single();

  if (error) {
    throw new AdminOrderCaseError(
      'Failed to mark the return instructions email as sent.',
      'database_error',
      500,
      error,
    );
  }

  return data as ReturnCaseRow;
}

export async function resolveAdminOrderCancellation(args: {
  actor: VerifiedAdminOperator;
  input: AdminCancellationResolveInput;
  now?: Date;
  orderNumber: string;
}): Promise<AdminCancellationResolveResult> {
  const resolvedAt = (args.now ?? new Date()).toISOString();
  const requestId = normalizeOptionalText(args.input.requestId);
  const resolution = normalizeCancellationResolution(args.input.resolution);
  const adminNote = normalizeOptionalText(args.input.adminNote);

  if (!requestId) {
    throw new AdminOrderCaseError(
      'requestId is required.',
      'invalid_cancellation_payload',
      400,
    );
  }

  const order = await loadOrderCaseRow(args.orderNumber);
  const cancellationRequest = await loadCancellationRequest({
    orderId: order.id,
    requestId,
  });

  if (cancellationRequest.status !== 'open') {
    throw new AdminOrderCaseError(
      'Only open cancellation requests can be resolved.',
      'case_not_open',
      409,
    );
  }

  if (resolution === 'decline_request') {
    const updatedRequest = await resolveCancellationRequest({
      adminNote,
      requestId,
      resolvedAt,
      resolvedBy: getCancellationResolvedBy(),
      status: 'rejected',
    });

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      cancellationRequest: mapCancellationRequest(updatedRequest),
      orderStatus: null,
    };
  }

  const atomicResult = await acceptCancellationRequestAtomically({
    actor: args.actor,
    adminNote,
    orderNumber: args.orderNumber,
    requestId,
    resolvedAt,
  });
  const orderStatus = await buildOrderStatusResultFromAtomicMutation({
    changedAt: resolvedAt,
    order: atomicResult.order,
    previousStatus: atomicResult.previousStatus,
  });

  return {
    orderId: atomicResult.order.id,
    orderNumber: atomicResult.order.order_number,
    cancellationRequest: mapCancellationRequest(
      atomicResult.request as CancellationRequestRow,
    ),
    orderStatus,
  };
}

export async function createAdminOrderReturnCase(args: {
  input: AdminReturnCaseInput;
  now?: Date;
  orderNumber: string;
}): Promise<AdminReturnCaseResult> {
  const now = args.now ?? new Date();
  const order = await loadOrderCaseRow(args.orderNumber);
  const [items, openReturnCase] = await Promise.all([
    loadOrderItems(order.id),
    loadOpenReturnCase(order.id),
  ]);
  const ineligibilityReason = getAdminReturnIneligibilityReason({
    hasOpenReturnCase: openReturnCase !== null,
    itemRows: items,
    now,
    order,
  });

  if (ineligibilityReason) {
    throw new AdminOrderCaseError(
      `This order is not eligible for a return case: ${ineligibilityReason}.`,
      'return_not_eligible',
      409,
    );
  }

  const returnCase = await createReturnCase({
    createdAt: now.toISOString(),
    orderId: order.id,
    reason: normalizeOptionalText(args.input.reason),
  });

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    returnCase: mapReturnCase(returnCase),
    orderStatus: null,
  };
}

export async function closeAdminOrderReturnCase(args: {
  input: AdminReturnCaseInput;
  now?: Date;
  orderNumber: string;
  returnCaseId: string;
}): Promise<AdminReturnCaseResult> {
  const now = args.now ?? new Date();
  const order = await loadOrderCaseRow(args.orderNumber);
  const returnCase = await loadReturnCase({
    orderId: order.id,
    returnCaseId: args.returnCaseId,
  });

  if (returnCase.status !== 'open' && returnCase.status !== 'awaiting_goods') {
    throw new AdminOrderCaseError(
      'Only active return cases can be closed.',
      'case_not_open',
      409,
    );
  }

  const updatedCase = await updateReturnCase({
    at: now.toISOString(),
    returnCaseId: returnCase.id,
    status: 'closed_without_return',
  });

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    returnCase: mapReturnCase(updatedCase),
    orderStatus: null,
  };
}

export async function markAdminOrderReturnCaseAwaitingGoods(args: {
  now?: Date;
  orderNumber: string;
  returnCaseId: string;
}): Promise<AdminReturnCaseResult> {
  const now = args.now ?? new Date();
  const awaitingGoodsAt = now.toISOString();
  const order = await loadOrderCaseRow(args.orderNumber);
  const existingReturnCase = await loadReturnCase({
    orderId: order.id,
    returnCaseId: args.returnCaseId,
  });

  if (existingReturnCase.status !== 'open') {
    throw new AdminOrderCaseError(
      'Only open return cases can move to awaiting goods.',
      'case_not_open',
      409,
    );
  }

  let returnCase = await markReturnCaseAwaitingGoodsAtomically({
    awaitingGoodsAt,
    orderNumber: args.orderNumber,
    returnCaseId: existingReturnCase.id,
  });
  const { sendReturnInstructionsEmail } = await import(
    '@/src/global/b2c/return-emails'
  );
  const emailResult = await sendReturnInstructionsEmail({
    customerEmail: order.customer_email,
    customerFirstName: getCustomerFirstName(order.customer_snapshot),
    orderNumber: order.order_number,
  });

  if (emailResult.success) {
    returnCase = await markReturnInstructionsSent(
      returnCase.id,
      new Date().toISOString(),
    );
  } else {
    console.error(
      '[B2C Returns] Failed to send return instructions email.',
      emailResult.error,
    );
  }

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    returnCase: mapReturnCase(returnCase),
    orderStatus: null,
    customerEmail: {
      attempted: true,
      status: emailResult.success ? 'sent' : 'failed',
    },
  };
}

export async function completeAdminOrderReturnCase(args: {
  actor: VerifiedAdminOperator;
  input: AdminReturnCaseInput;
  now?: Date;
  orderNumber: string;
  returnCaseId: string;
}): Promise<AdminReturnCaseResult> {
  const now = args.now ?? new Date();
  const order = await loadOrderCaseRow(args.orderNumber);
  const returnCase = await loadReturnCase({
    orderId: order.id,
    returnCaseId: args.returnCaseId,
  });

  if (returnCase.status !== 'awaiting_goods') {
    throw new AdminOrderCaseError(
      'Only return cases awaiting goods can be completed.',
      'case_not_open',
      409,
    );
  }

  const atomicResult = await completeReturnCaseAtomically({
    actor: args.actor,
    adminNote: normalizeOptionalText(args.input.adminNote),
    completedAt: now.toISOString(),
    orderNumber: args.orderNumber,
    returnCaseId: returnCase.id,
  });
  const orderStatus = await buildOrderStatusResultFromAtomicMutation({
    changedAt: now.toISOString(),
    order: atomicResult.order,
    previousStatus: atomicResult.previousStatus,
  });

  return {
    orderId: atomicResult.order.id,
    orderNumber: atomicResult.order.order_number,
    returnCase: mapReturnCase(atomicResult.returnCase as ReturnCaseRow),
    orderStatus,
  };
}
