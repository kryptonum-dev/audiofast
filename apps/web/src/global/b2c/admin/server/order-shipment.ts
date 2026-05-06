import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';

import {
  parseOrderShipmentData,
  type ParsedOrderShipmentData,
} from '@/src/global/b2c/utils/orders';
import { normalizeOptionalText } from '@/src/global/b2c/utils/text';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

type OrderShipmentRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'current_status'
  | 'id'
  | 'order_number'
  | 'shipment_data'
  | 'shipped_at'
  | 'updated_at'
>;

type OrdersUpdate = Database['public']['Tables']['orders']['Update'];

export type AdminOrderShipmentInput = {
  carrier?: string | null;
  shippedAt?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
};

export type AdminOrderShipmentResult = {
  orderId: string;
  orderNumber: string;
  currentStatus: string;
  shipment: ParsedOrderShipmentData;
  updatedAt: string;
};

export class AdminOrderShipmentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid_shipment_payload'
      | 'order_not_found'
      | 'shipment_not_editable'
      | 'database_error',
    public readonly status: number,
    public readonly causeError: PostgrestError | Error | null = null,
  ) {
    super(message);
    this.name = 'AdminOrderShipmentError';
  }
}

function normalizeIsoDate(value: string | null, fieldName: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AdminOrderShipmentError(
      `Invalid ${fieldName} timestamp.`,
      'invalid_shipment_payload',
      400,
    );
  }

  return parsed.toISOString();
}

function normalizeTrackingUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    throw new AdminOrderShipmentError(
      'Invalid trackingUrl.',
      'invalid_shipment_payload',
      400,
    );
  }
}

export function buildAdminOrderShipmentPayload(args: {
  input: AdminOrderShipmentInput;
  now: Date;
  previousShipmentData: Json | null;
  previousShippedAt: string | null;
}): OrdersUpdate {
  const carrier = normalizeOptionalText(args.input.carrier);
  const trackingNumber = normalizeOptionalText(args.input.trackingNumber);
  const trackingUrl = normalizeTrackingUrl(
    normalizeOptionalText(args.input.trackingUrl),
  );
  const previousShipment = parseOrderShipmentData(
    args.previousShipmentData,
    args.previousShippedAt,
  );
  const shippedAt =
    normalizeIsoDate(normalizeOptionalText(args.input.shippedAt), 'shippedAt') ??
    previousShipment?.shippedAt ??
    args.previousShippedAt;

  if (!carrier || !trackingNumber) {
    throw new AdminOrderShipmentError(
      'carrier and trackingNumber are required.',
      'invalid_shipment_payload',
      400,
    );
  }

  return {
    shipment_data: {
      carrier,
      shippedAt,
      trackingNumber,
      trackingUrl,
    },
    shipped_at: shippedAt,
    updated_at: args.now.toISOString(),
  };
}

async function loadOrderShipmentRow(
  orderNumber: string,
): Promise<OrderShipmentRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('current_status, id, order_number, shipment_data, shipped_at, updated_at')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    throw new AdminOrderShipmentError(
      'Failed to load the B2C order before shipment update.',
      'database_error',
      500,
      error,
    );
  }

  if (!data) {
    throw new AdminOrderShipmentError(
      'The requested B2C order could not be found.',
      'order_not_found',
      404,
    );
  }

  return data as OrderShipmentRow;
}

async function updateOrderShipment(args: {
  orderId: string;
  payload: OrdersUpdate;
}): Promise<OrderShipmentRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .update(args.payload)
    .eq('id', args.orderId)
    .select('current_status, id, order_number, shipment_data, shipped_at, updated_at')
    .single();

  if (error) {
    throw new AdminOrderShipmentError(
      'Failed to update the B2C order shipment.',
      'database_error',
      500,
      error,
    );
  }

  return data as OrderShipmentRow;
}

function mapShipmentResult(row: OrderShipmentRow): AdminOrderShipmentResult {
  const shipment = parseOrderShipmentData(row.shipment_data, row.shipped_at);

  if (!shipment) {
    throw new AdminOrderShipmentError(
      'The updated shipment payload could not be parsed.',
      'database_error',
      500,
    );
  }

  return {
    orderId: row.id,
    orderNumber: row.order_number,
    currentStatus: row.current_status,
    shipment,
    updatedAt: row.updated_at,
  };
}

export async function updateAdminOrderShipment(args: {
  input: AdminOrderShipmentInput;
  now?: Date;
  orderNumber: string;
}): Promise<AdminOrderShipmentResult> {
  const now = args.now ?? new Date();
  const currentRow = await loadOrderShipmentRow(args.orderNumber);

  if (
    currentRow.current_status === 'cancelled' ||
    currentRow.current_status === 'returned'
  ) {
    throw new AdminOrderShipmentError(
      'Shipment details cannot be edited for cancelled or returned orders.',
      'shipment_not_editable',
      409,
    );
  }

  const payload = buildAdminOrderShipmentPayload({
    input: args.input,
    now,
    previousShipmentData: currentRow.shipment_data,
    previousShippedAt: currentRow.shipped_at,
  });
  const updatedRow = await updateOrderShipment({
    orderId: currentRow.id,
    payload,
  });

  return mapShipmentResult(updatedRow);
}
