import { sanityAppConfig } from "../config.js";
import type {
  AdminApiEnvelope,
  AdminOrdersResult,
  OrdersFilters,
} from "./types.js";

export class AdminApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminApiError";
  }
}

export async function fetchAdminOrders(args: {
  authToken: string;
  filters: OrdersFilters;
  page: number;
  limit: number;
  signal?: AbortSignal;
}): Promise<AdminOrdersResult> {
  const params = new URLSearchParams({
    page: String(args.page),
    limit: String(args.limit),
  });
  const search = args.filters.search.trim();

  if (search) {
    params.set("q", search);
  }

  if (args.filters.status !== "all") {
    params.set("status", args.filters.status);
  }

  if (args.filters.lineType !== "all") {
    params.set("lineType", args.filters.lineType);
  }

  if (args.filters.operations === "cancellation") {
    params.set("hasOpenCancellationRequest", "true");
  }

  if (args.filters.operations === "return") {
    params.set("hasOpenReturnCase", "true");
  }

  if (args.filters.dateRange.from) {
    params.set(
      "createdFrom",
      new Date(`${args.filters.dateRange.from}T00:00:00`).toISOString(),
    );
  }

  if (args.filters.dateRange.to) {
    params.set(
      "createdTo",
      new Date(`${args.filters.dateRange.to}T23:59:59.999`).toISOString(),
    );
  }

  const response = await fetch(
    `${sanityAppConfig.adminApiBaseUrl}/api/admin/orders/?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${args.authToken}`,
      },
      signal: args.signal,
    },
  );
  const payload =
    (await response.json()) as AdminApiEnvelope<AdminOrdersResult>;

  if (!response.ok || !payload.ok) {
    throw new AdminApiError(
      payload.ok === false
        ? payload.message
        : "Nie udało się załadować zamówień.",
    );
  }

  return payload.data;
}
