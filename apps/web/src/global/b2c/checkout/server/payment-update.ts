import type { PostgrestError } from '@supabase/supabase-js';

import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';

import {
  appendCheckoutStatusHistoryEntry,
  type CheckoutOrderStatus,
  type CheckoutStatusHistoryEntry,
} from '../order-draft';

type OrderPaymentStateRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'created_at'
  | 'id'
  | 'order_number'
  | 'current_status'
  | 'payable_until'
  | 'payment_provider'
  | 'status_history'
  | 'payment_reference'
  | 'payment_verified_at'
  | 'paid_at'
>;

type OrdersUpdate = Database['public']['Tables']['orders']['Update'];

export class CheckoutPaymentUpdateError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'not_found'
      | 'invalid_order_state'
      | 'database_error',
    public readonly causeError: PostgrestError | Error | null = null,
  ) {
    super(message);
    this.name = 'CheckoutPaymentUpdateError';
  }
}

export type ConfirmCheckoutPaymentResult = {
  orderId: string;
  orderNumber: string;
  currentStatus: CheckoutOrderStatus;
  statusHistory: CheckoutStatusHistoryEntry[];
  paymentReference: string | null;
  paymentVerifiedAt: string | null;
  paidAt: string | null;
  wasAlreadyPaid: boolean;
};

function isCheckoutOrderStatus(value: unknown): value is CheckoutOrderStatus {
  return (
    value === 'awaiting_payment' ||
    value === 'awaiting_confirmation' ||
    value === 'paid'
  );
}

function normalizePaymentReference(value: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeIsoTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new CheckoutPaymentUpdateError(
      'Received an invalid payment verification timestamp.',
      'invalid_order_state',
    );
  }

  return date.toISOString();
}

function normalizeCheckoutStatusHistory(
  value: unknown,
): CheckoutStatusHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('status' in entry) ||
      !('changedAt' in entry) ||
      !('source' in entry)
    ) {
      return [];
    }

    const status = entry.status;
    const changedAt = entry.changedAt;
    const source = entry.source;

    if (
      !isCheckoutOrderStatus(status) ||
      typeof changedAt !== 'string' ||
      source !== 'system'
    ) {
      return [];
    }

    return [
      {
        status,
        changedAt,
        source,
      },
    ];
  });
}

function mapOrderPaymentStateRow(
  row: OrderPaymentStateRow,
  wasAlreadyPaid: boolean,
): ConfirmCheckoutPaymentResult {
  const normalizedStatus = isCheckoutOrderStatus(row.current_status)
    ? row.current_status
    : 'awaiting_payment';

  return {
    orderId: row.id,
    orderNumber: row.order_number,
    currentStatus: normalizedStatus,
    statusHistory: normalizeCheckoutStatusHistory(row.status_history),
    paymentReference: row.payment_reference,
    paymentVerifiedAt: row.payment_verified_at,
    paidAt: row.paid_at,
    wasAlreadyPaid,
  };
}

function createAwaitingPaymentHistoryEntry(
  createdAt: string,
): CheckoutStatusHistoryEntry {
  return {
    status: 'awaiting_payment',
    changedAt: createdAt,
    source: 'system',
  };
}

function ensureAwaitingPaymentHistory(args: {
  history: CheckoutStatusHistoryEntry[];
  createdAt: string;
}): CheckoutStatusHistoryEntry[] {
  if (args.history.some((entry) => entry.status === 'awaiting_payment')) {
    return args.history;
  }

  return [createAwaitingPaymentHistoryEntry(args.createdAt), ...args.history];
}

function ensureAwaitingConfirmationHistory(args: {
  history: CheckoutStatusHistoryEntry[];
  createdAt: string;
  paidAt: string;
}): CheckoutStatusHistoryEntry[] {
  const historyWithAwaiting = ensureAwaitingPaymentHistory({
    history: args.history,
    createdAt: args.createdAt,
  });

  if (
    historyWithAwaiting.some(
      (entry) => entry.status === 'awaiting_confirmation',
    )
  ) {
    return historyWithAwaiting;
  }

  return appendCheckoutStatusHistoryEntry({
    history: historyWithAwaiting,
    status: 'awaiting_confirmation',
    changedAt: args.paidAt,
  });
}

function isPostPaymentConfirmationStatus(
  status: string,
): status is Extract<CheckoutOrderStatus, 'awaiting_confirmation' | 'paid'> {
  return status === 'awaiting_confirmation' || status === 'paid';
}

function areStatusHistoriesEqual(
  left: CheckoutStatusHistoryEntry[],
  right: CheckoutStatusHistoryEntry[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertPaymentProvider(row: OrderPaymentStateRow): void {
  if (row.payment_provider !== 'przelewy24') {
    throw new CheckoutPaymentUpdateError(
      `Checkout order uses unsupported payment provider ${row.payment_provider}.`,
      'invalid_order_state',
    );
  }
}

function assertPaymentNotExpired(args: {
  payableUntil: string;
  verifiedAt: string;
}): void {
  const payableUntil = normalizeIsoTimestamp(args.payableUntil);

  if (new Date(args.verifiedAt).getTime() > new Date(payableUntil).getTime()) {
    throw new CheckoutPaymentUpdateError(
      'Checkout order is no longer payable.',
      'invalid_order_state',
    );
  }
}

async function updateOrderPaymentState(args: {
  orderId: string;
  expectedCurrentStatus: CheckoutOrderStatus;
  payload: OrdersUpdate;
}): Promise<OrderPaymentStateRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .update(args.payload)
    .eq('id', args.orderId)
    .eq('current_status', args.expectedCurrentStatus)
    .select(
      'created_at, id, order_number, current_status, payable_until, payment_provider, status_history, payment_reference, payment_verified_at, paid_at',
    )
    .single();

  if (!error && data) {
    return data;
  }

  if (error && error.code !== 'PGRST116') {
    throw new CheckoutPaymentUpdateError(
      'Failed to update checkout order payment state.',
      'database_error',
      error,
    );
  }

  return null;
}

async function loadOrderPaymentState(
  orderId: string,
): Promise<OrderPaymentStateRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      'created_at, id, order_number, current_status, payable_until, payment_provider, status_history, payment_reference, payment_verified_at, paid_at',
    )
    .eq('id', orderId)
    .single();

  if (error) {
    throw new CheckoutPaymentUpdateError(
      error.code === 'PGRST116'
        ? 'Checkout order not found for payment confirmation.'
        : 'Failed to load checkout order payment state.',
      error.code === 'PGRST116' ? 'not_found' : 'database_error',
      error,
    );
  }

  return data;
}

export async function confirmCheckoutOrderPayment(args: {
  orderId: string;
  paymentReference: string | null;
  verifiedAt: string;
}): Promise<ConfirmCheckoutPaymentResult> {
  const verifiedAt = normalizeIsoTimestamp(args.verifiedAt);
  const paymentReference = normalizePaymentReference(args.paymentReference);
  const currentState = await loadOrderPaymentState(args.orderId);
  assertPaymentProvider(currentState);

  if (isPostPaymentConfirmationStatus(currentState.current_status)) {
    const currentHistory = normalizeCheckoutStatusHistory(
      currentState.status_history,
    );
    const repairedHistory = ensureAwaitingConfirmationHistory({
      history: currentHistory,
      createdAt: currentState.created_at,
      paidAt:
        currentState.paid_at ?? currentState.payment_verified_at ?? verifiedAt,
    });
    const repairedPayload: OrdersUpdate = {};

    if (!areStatusHistoriesEqual(currentHistory, repairedHistory)) {
      repairedPayload.status_history = repairedHistory;
    }
    if (currentState.payment_reference === null && paymentReference !== null) {
      repairedPayload.payment_reference = paymentReference;
    }
    if (currentState.payment_verified_at === null) {
      repairedPayload.payment_verified_at = verifiedAt;
    }
    if (currentState.paid_at === null) {
      repairedPayload.paid_at = verifiedAt;
    }

    if (Object.keys(repairedPayload).length === 0) {
      return mapOrderPaymentStateRow(currentState, true);
    }

    repairedPayload.updated_at = verifiedAt;

    const repairedState = await updateOrderPaymentState({
      orderId: args.orderId,
      expectedCurrentStatus: currentState.current_status,
      payload: repairedPayload,
    });

    return mapOrderPaymentStateRow(repairedState ?? currentState, true);
  }

  if (currentState.current_status !== 'awaiting_payment') {
    throw new CheckoutPaymentUpdateError(
      `Checkout order is not payable from state ${currentState.current_status}.`,
      'invalid_order_state',
    );
  }

  assertPaymentNotExpired({
    payableUntil: currentState.payable_until,
    verifiedAt,
  });
  const currentHistory = normalizeCheckoutStatusHistory(
    currentState.status_history,
  );

  if (
    currentHistory.some(
      (entry) =>
        entry.status === 'awaiting_confirmation' || entry.status === 'paid',
    )
  ) {
    throw new CheckoutPaymentUpdateError(
      'Checkout order history is inconsistent with its awaiting_payment state.',
      'invalid_order_state',
    );
  }

  const nextStatusHistory = appendCheckoutStatusHistoryEntry({
    history: ensureAwaitingPaymentHistory({
      history: currentHistory,
      createdAt: currentState.created_at,
    }),
    status: 'awaiting_confirmation',
    changedAt: verifiedAt,
  });

  const updatePayload: OrdersUpdate = {
    current_status: 'awaiting_confirmation',
    status_history: nextStatusHistory,
    payment_reference: paymentReference,
    payment_verified_at: verifiedAt,
    paid_at: verifiedAt,
    updated_at: verifiedAt,
  };

  const updatedState = await updateOrderPaymentState({
    orderId: args.orderId,
    expectedCurrentStatus: 'awaiting_payment',
    payload: updatePayload,
  });

  if (updatedState) {
    return mapOrderPaymentStateRow(updatedState, false);
  }

  const reloadedState = await loadOrderPaymentState(args.orderId);
  assertPaymentProvider(reloadedState);

  if (isPostPaymentConfirmationStatus(reloadedState.current_status)) {
    return mapOrderPaymentStateRow(reloadedState, true);
  }

  throw new CheckoutPaymentUpdateError(
    'Checkout order payment confirmation could not be finalized.',
    'invalid_order_state',
  );
}
