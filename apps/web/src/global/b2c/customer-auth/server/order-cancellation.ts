import "server-only";

import { isCancellableOrderStatus } from "@/src/global/b2c/utils/statuses";
import { normalizeOptionalText } from "@/src/global/b2c/utils/text";
import { createAdminClient } from "@/src/global/supabase/admin";
import type { Database } from "@/src/global/supabase/database.types";

type OrderRow = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "current_status" | "customer_email" | "id" | "order_number"
>;
type CancellationRequestRow =
  Database["public"]["Tables"]["order_cancellation_requests"]["Row"];

export type CustomerOrderCancellationRequestSummary = {
  id: string;
  status: string;
  reason: string | null;
  requestedAt: string;
};

export type RequestCustomerOrderCancellationInput = {
  orderNumber: string;
  normalizedEmail: string;
  reason?: string | null;
  now?: Date;
};

export type RequestCustomerOrderCancellationResult =
  | {
      kind: "created";
      request: CustomerOrderCancellationRequestSummary;
    }
  | {
      kind: "already_requested";
      request: CustomerOrderCancellationRequestSummary;
    }
  | {
      kind: "not_eligible";
      currentStatus: string;
    }
  | {
      kind: "not_found";
    };

const CANCELLATION_REQUEST_SELECT = "id, status, reason, requested_at";

function mapCancellationRequest(
  request: Pick<
    CancellationRequestRow,
    "id" | "reason" | "requested_at" | "status"
  >,
): CustomerOrderCancellationRequestSummary {
  return {
    id: request.id,
    status: request.status,
    reason: request.reason,
    requestedAt: request.requested_at,
  };
}

async function loadOpenCancellationRequest(
  orderId: string,
): Promise<CustomerOrderCancellationRequestSummary | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("order_cancellation_requests")
    .select(CANCELLATION_REQUEST_SELECT)
    .eq("order_id", orderId)
    .eq("status", "open")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCancellationRequest(data) : null;
}

async function loadOwnedOrder({
  normalizedEmail,
  orderNumber,
}: Pick<
  RequestCustomerOrderCancellationInput,
  "normalizedEmail" | "orderNumber"
>): Promise<OrderRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, current_status, customer_email")
    .eq("order_number", orderNumber)
    .ilike("customer_email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function requestCustomerOrderCancellation({
  normalizedEmail,
  now = new Date(),
  orderNumber,
  reason,
}: RequestCustomerOrderCancellationInput): Promise<RequestCustomerOrderCancellationResult> {
  const order = await loadOwnedOrder({ normalizedEmail, orderNumber });

  if (!order) {
    return { kind: "not_found" };
  }

  if (!isCancellableOrderStatus(order.current_status)) {
    return {
      kind: "not_eligible",
      currentStatus: order.current_status,
    };
  }

  const existingRequest = await loadOpenCancellationRequest(order.id);

  if (existingRequest) {
    return {
      kind: "already_requested",
      request: existingRequest,
    };
  }

  const requestedAt = now.toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("order_cancellation_requests")
    .insert({
      customer_email: order.customer_email,
      customer_message: null,
      order_id: order.id,
      reason: normalizeOptionalText(reason),
      requested_at: requestedAt,
      status: "open",
      updated_at: requestedAt,
    })
    .select(CANCELLATION_REQUEST_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      const duplicateRequest = await loadOpenCancellationRequest(order.id);

      if (duplicateRequest) {
        return {
          kind: "already_requested",
          request: duplicateRequest,
        };
      }
    }

    throw error;
  }

  return {
    kind: "created",
    request: mapCancellationRequest(data),
  };
}
