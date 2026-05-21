import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';

import {
  compareOrderDateOnlyStrings,
  isOrderDateOnlyString,
  type ParsedOrderExpectedDeliveryEstimate,
  parseOrderExpectedDeliveryEstimate,
} from '@/src/global/b2c/utils/orders';
import { normalizeOptionalText } from '@/src/global/b2c/utils/text';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';

type OrderDeliveryEstimateRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'current_status'
  | 'expected_delivery_from'
  | 'expected_delivery_to'
  | 'id'
  | 'order_number'
  | 'updated_at'
>;

type OrdersUpdate = Database['public']['Tables']['orders']['Update'];

export type AdminOrderDeliveryEstimateInput = {
  expectedDeliveryFrom?: string | null;
  expectedDeliveryTo?: string | null;
};

export type AdminOrderDeliveryEstimateResult = {
  orderId: string;
  orderNumber: string;
  currentStatus: string;
  deliveryEstimate: ParsedOrderExpectedDeliveryEstimate | null;
  updatedAt: string;
};

export class AdminOrderDeliveryEstimateError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid_delivery_estimate_payload'
      | 'order_not_found'
      | 'delivery_estimate_not_editable'
      | 'database_error',
    public readonly status: number,
    public readonly causeError: PostgrestError | Error | null = null,
  ) {
    super(message);
    this.name = 'AdminOrderDeliveryEstimateError';
  }
}

function normalizeExpectedDeliveryDate(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  if (!isOrderDateOnlyString(normalized)) {
    throw new AdminOrderDeliveryEstimateError(
      `${fieldName} must be a valid YYYY-MM-DD date.`,
      'invalid_delivery_estimate_payload',
      400,
    );
  }

  return normalized;
}

export function buildAdminOrderDeliveryEstimatePayload(args: {
  input: AdminOrderDeliveryEstimateInput;
  now: Date;
}): OrdersUpdate {
  const expectedDeliveryFrom = normalizeExpectedDeliveryDate(
    args.input.expectedDeliveryFrom,
    'expectedDeliveryFrom',
  );
  const expectedDeliveryTo = normalizeExpectedDeliveryDate(
    args.input.expectedDeliveryTo,
    'expectedDeliveryTo',
  );

  if (!expectedDeliveryFrom && expectedDeliveryTo) {
    throw new AdminOrderDeliveryEstimateError(
      'expectedDeliveryFrom is required when expectedDeliveryTo is provided.',
      'invalid_delivery_estimate_payload',
      400,
    );
  }

  if (
    expectedDeliveryFrom &&
    expectedDeliveryTo &&
    compareOrderDateOnlyStrings(expectedDeliveryTo, expectedDeliveryFrom) < 0
  ) {
    throw new AdminOrderDeliveryEstimateError(
      'expectedDeliveryTo must be on or after expectedDeliveryFrom.',
      'invalid_delivery_estimate_payload',
      400,
    );
  }

  return {
    expected_delivery_from: expectedDeliveryFrom,
    expected_delivery_to: expectedDeliveryTo,
    updated_at: args.now.toISOString(),
  };
}

export function canEditDeliveryEstimate(status: string): boolean {
  return (
    status === 'awaiting_confirmation' ||
    status === 'paid' ||
    status === 'processing' ||
    status === 'shipped'
  );
}

async function loadOrderDeliveryEstimateRow(
  orderNumber: string,
): Promise<OrderDeliveryEstimateRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      'current_status, expected_delivery_from, expected_delivery_to, id, order_number, updated_at',
    )
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    throw new AdminOrderDeliveryEstimateError(
      'Failed to load the B2C order before delivery estimate update.',
      'database_error',
      500,
      error,
    );
  }

  if (!data) {
    throw new AdminOrderDeliveryEstimateError(
      'The requested B2C order could not be found.',
      'order_not_found',
      404,
    );
  }

  return data as OrderDeliveryEstimateRow;
}

async function updateOrderDeliveryEstimate(args: {
  orderId: string;
  payload: OrdersUpdate;
}): Promise<OrderDeliveryEstimateRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .update(args.payload)
    .eq('id', args.orderId)
    .select(
      'current_status, expected_delivery_from, expected_delivery_to, id, order_number, updated_at',
    )
    .single();

  if (error) {
    throw new AdminOrderDeliveryEstimateError(
      'Failed to update the B2C order delivery estimate.',
      'database_error',
      500,
      error,
    );
  }

  return data as OrderDeliveryEstimateRow;
}

function mapDeliveryEstimateResult(
  row: OrderDeliveryEstimateRow,
): AdminOrderDeliveryEstimateResult {
  return {
    orderId: row.id,
    orderNumber: row.order_number,
    currentStatus: row.current_status,
    deliveryEstimate: parseOrderExpectedDeliveryEstimate(
      row.expected_delivery_from,
      row.expected_delivery_to,
    ),
    updatedAt: row.updated_at,
  };
}

export async function updateAdminOrderDeliveryEstimate(args: {
  input: AdminOrderDeliveryEstimateInput;
  now?: Date;
  orderNumber: string;
}): Promise<AdminOrderDeliveryEstimateResult> {
  const now = args.now ?? new Date();
  const currentRow = await loadOrderDeliveryEstimateRow(args.orderNumber);

  if (!canEditDeliveryEstimate(currentRow.current_status)) {
    throw new AdminOrderDeliveryEstimateError(
      'Delivery estimate cannot be edited for this order status.',
      'delivery_estimate_not_editable',
      409,
    );
  }

  const payload = buildAdminOrderDeliveryEstimatePayload({
    input: args.input,
    now,
  });
  const updatedRow = await updateOrderDeliveryEstimate({
    orderId: currentRow.id,
    payload,
  });

  return mapDeliveryEstimateResult(updatedRow);
}
