import { sanityAppConfig } from "../config.js";
import type {
  AdminAnalyticsResult,
  AdminApiEnvelope,
  AdminCoupon,
  AdminCouponMutationInput,
  AdminCouponProductsResult,
  AdminCouponsResult,
  AdminInvoiceUploadResult,
  AdminOrderStatus,
  AdminReturnCaseMutationResult,
  AdminOrderDetail,
  AdminOrdersResult,
  AnalyticsFilters,
  CouponsFilters,
  OrdersFilters,
} from "./types.js";

export class AdminApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminApiError";
  }
}

export function getAdminErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  return error instanceof AdminApiError ? error.message : fallbackMessage;
}

const ADMIN_NETWORK_ERROR_MESSAGE =
  "Nie udało się połączyć z API admina. Spróbuj ponownie za chwilę.";

function adminApiUrl(path: string): string {
  const baseUrl = sanityAppConfig.adminApiBaseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

async function adminFetch(
  path: string,
  init: RequestInit,
  fallbackMessage = ADMIN_NETWORK_ERROR_MESSAGE,
): Promise<Response> {
  try {
    return await fetch(adminApiUrl(path), init);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new AdminApiError(fallbackMessage);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
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

  const response = await adminFetch(
    `/api/admin/orders/?${params}`,
    {
      headers: {
        Authorization: `Bearer ${args.authToken}`,
      },
      signal: args.signal,
    },
    "Nie udało się połączyć z API zamówień. Spróbuj ponownie za chwilę.",
  );

  return readAdminEnvelope<AdminOrdersResult>(
    response,
    "Nie udało się załadować zamówień.",
  );
}

export async function fetchAdminAnalytics(args: {
  authToken: string;
  filters: AnalyticsFilters;
  signal?: AbortSignal;
}): Promise<AdminAnalyticsResult> {
  const params = new URLSearchParams({
    groupBy: args.filters.groupBy,
  });

  if (args.filters.dateRange.from) {
    params.set(
      "from",
      new Date(`${args.filters.dateRange.from}T00:00:00`).toISOString(),
    );
  }

  if (args.filters.dateRange.to) {
    params.set(
      "to",
      new Date(`${args.filters.dateRange.to}T23:59:59.999`).toISOString(),
    );
  }

  const response = await adminFetch(
    `/api/admin/analytics/?${params}`,
    {
      headers: {
        Authorization: `Bearer ${args.authToken}`,
      },
      signal: args.signal,
    },
    "Nie udało się połączyć z API analityki. Spróbuj ponownie za chwilę.",
  );

  return readAdminEnvelope<AdminAnalyticsResult>(
    response,
    "Nie udało się załadować analityki.",
  );
}

export async function fetchAdminCoupons(args: {
  authToken: string;
  filters: CouponsFilters;
  page: number;
  limit: number;
  signal?: AbortSignal;
}): Promise<AdminCouponsResult> {
  const offset = Math.max(args.page - 1, 0) * args.limit;
  const params = new URLSearchParams({
    limit: String(args.limit),
  });
  const search = args.filters.search.trim();

  if (offset > 0) {
    params.set("cursor", String(offset));
  }

  if (search) {
    params.set("q", search);
  }

  if (args.filters.status !== "all") {
    params.set("derivedStatus", args.filters.status);
  }

  if (args.filters.discountType !== "all") {
    params.set("discountType", args.filters.discountType);
  }

  const response = await adminFetch(
    `/api/admin/coupons/?${params}`,
    {
      headers: {
        Authorization: `Bearer ${args.authToken}`,
      },
      signal: args.signal,
    },
    "Nie udało się połączyć z API kuponów. Spróbuj ponownie za chwilę.",
  );
  const data = await readAdminEnvelope<AdminCouponsResult>(
    response,
    "Nie udało się załadować kuponów.",
  );

  const totalCount = data.pagination.total;
  const pageSize = data.pagination.limit;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    ...data,
    pagination: {
      ...data.pagination,
      currentPage: args.page,
      pageSize,
      totalCount,
      totalPages,
    },
  };
}

export async function createAdminCoupon(args: {
  authToken: string;
  input: AdminCouponMutationInput;
}): Promise<AdminCoupon> {
  const response = await adminFetch("/api/admin/coupons/", {
    body: JSON.stringify(args.input),
    headers: {
      Authorization: `Bearer ${args.authToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return readAdminEnvelope<AdminCoupon>(
    response,
    "Nie udało się utworzyć kuponu.",
  );
}

export async function fetchAdminCoupon(args: {
  authToken: string;
  couponId: string;
  signal?: AbortSignal;
}): Promise<AdminCoupon> {
  const response = await adminFetch(
    `/api/admin/coupons/${encodeURIComponent(args.couponId)}/`,
    {
      headers: {
        Authorization: `Bearer ${args.authToken}`,
      },
      signal: args.signal,
    },
  );

  return readAdminEnvelope<AdminCoupon>(
    response,
    "Nie udało się załadować kuponu.",
  );
}

export async function updateAdminCoupon(args: {
  authToken: string;
  couponId: string;
  input: AdminCouponMutationInput;
}): Promise<AdminCoupon> {
  const response = await adminFetch(
    `/api/admin/coupons/${encodeURIComponent(args.couponId)}/`,
    {
      body: JSON.stringify(args.input),
      headers: {
        Authorization: `Bearer ${args.authToken}`,
        "Content-Type": "application/json",
      },
      method: "PATCH",
    },
  );

  return readAdminEnvelope<AdminCoupon>(
    response,
    "Nie udało się zapisać kuponu.",
  );
}

export async function archiveAdminCoupon(args: {
  authToken: string;
  couponId: string;
}): Promise<AdminCoupon> {
  const response = await adminFetch(
    `/api/admin/coupons/${encodeURIComponent(args.couponId)}/`,
    {
      headers: {
        Authorization: `Bearer ${args.authToken}`,
      },
      method: "DELETE",
    },
  );

  return readAdminEnvelope<AdminCoupon>(
    response,
    "Nie udało się usunąć kuponu.",
  );
}

export async function fetchAdminCouponProducts(args: {
  authToken: string;
  signal?: AbortSignal;
}): Promise<AdminCouponProductsResult> {
  const response = await adminFetch("/api/admin/coupons/products/", {
    headers: {
      Authorization: `Bearer ${args.authToken}`,
    },
    signal: args.signal,
  });

  return readAdminEnvelope<AdminCouponProductsResult>(
    response,
    "Nie udało się załadować produktów do kuponu.",
  );
}

export async function fetchAdminOrderDetail(args: {
  authToken: string;
  orderNumber: string;
  signal?: AbortSignal;
}): Promise<AdminOrderDetail> {
  const response = await adminFetch(
    `/api/admin/orders/${encodeURIComponent(args.orderNumber)}/`,
    {
      headers: {
        Authorization: `Bearer ${args.authToken}`,
      },
      signal: args.signal,
    },
  );

  return readAdminEnvelope<AdminOrderDetail>(
    response,
    "Nie udało się załadować szczegółów zamówienia.",
  );
}

async function readAdminEnvelope<TData>(
  response: Response,
  fallbackMessage: string,
): Promise<TData> {
  let payload: AdminApiEnvelope<TData>;

  try {
    payload = (await response.json()) as AdminApiEnvelope<TData>;
  } catch {
    throw new AdminApiError(fallbackMessage);
  }

  if (!response.ok || !payload.ok) {
    throw new AdminApiError(
      payload.ok === false ? payload.message : fallbackMessage,
    );
  }

  return payload.data;
}

async function adminJsonMutation<TData>(args: {
  authToken: string;
  body: unknown;
  fallbackMessage: string;
  method: "POST" | "PUT";
  path: string;
}): Promise<TData> {
  const response = await adminFetch(args.path, {
    body: JSON.stringify(args.body),
    headers: {
      Authorization: `Bearer ${args.authToken}`,
      "Content-Type": "application/json",
    },
    method: args.method,
  });

  return readAdminEnvelope<TData>(response, args.fallbackMessage);
}

function orderPath(orderNumber: string, suffix: string) {
  return `/api/admin/orders/${encodeURIComponent(orderNumber)}${suffix}`;
}

export async function updateAdminOrderStatus(args: {
  authToken: string;
  deliveryEstimate?: {
    expectedDeliveryFrom?: string | null;
    expectedDeliveryTo?: string | null;
  };
  note?: string;
  orderNumber: string;
  status: AdminOrderStatus;
}) {
  const body: {
    deliveryEstimate?: {
      expectedDeliveryFrom?: string | null;
      expectedDeliveryTo?: string | null;
    };
    note: string | null;
    status: AdminOrderStatus;
  } = {
    note: args.note || null,
    status: args.status,
  };

  if (args.deliveryEstimate !== undefined) {
    body.deliveryEstimate = args.deliveryEstimate;
  }

  return adminJsonMutation({
    authToken: args.authToken,
    body,
    fallbackMessage: "Nie udało się zmienić statusu zamówienia.",
    method: "POST",
    path: orderPath(args.orderNumber, "/status/"),
  });
}

export async function updateAdminOrderShipment(args: {
  authToken: string;
  carrier?: string;
  orderNumber: string;
  trackingNumber: string;
}) {
  return adminJsonMutation({
    authToken: args.authToken,
    body: {
      carrier: args.carrier || null,
      trackingNumber: args.trackingNumber,
    },
    fallbackMessage: "Nie udało się zapisać danych wysyłki.",
    method: "PUT",
    path: orderPath(args.orderNumber, "/shipment/"),
  });
}

export async function updateAdminOrderDeliveryEstimate(args: {
  authToken: string;
  expectedDeliveryFrom?: string | null;
  expectedDeliveryTo?: string | null;
  orderNumber: string;
}) {
  return adminJsonMutation({
    authToken: args.authToken,
    body: {
      expectedDeliveryFrom: args.expectedDeliveryFrom || null,
      expectedDeliveryTo: args.expectedDeliveryTo || null,
    },
    fallbackMessage: "Nie udało się zapisać przewidywanej dostawy.",
    method: "PUT",
    path: orderPath(args.orderNumber, "/delivery-estimate/"),
  });
}

export async function attachAdminOrderInvoice(args: {
  authToken: string;
  file: File;
  orderNumber: string;
}) {
  const formData = new FormData();
  formData.set("file", args.file);

  const response = await adminFetch(orderPath(args.orderNumber, "/invoice/"), {
    body: formData,
    headers: {
      Authorization: `Bearer ${args.authToken}`,
    },
    method: "POST",
  });

  return readAdminEnvelope<AdminInvoiceUploadResult>(
    response,
    "Nie udało się dodać faktury.",
  );
}

export async function downloadAdminOrderInvoice(args: {
  authToken: string;
  orderNumber: string;
}) {
  const response = await adminFetch(
    orderPath(args.orderNumber, "/invoice/download/"),
    {
      headers: {
        Authorization: `Bearer ${args.authToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new AdminApiError("Nie udało się pobrać faktury.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `faktura-${args.orderNumber}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function removeAdminOrderInvoice(args: {
  authToken: string;
  orderNumber: string;
}) {
  const response = await adminFetch(orderPath(args.orderNumber, "/invoice/"), {
    headers: {
      Authorization: `Bearer ${args.authToken}`,
    },
    method: "DELETE",
  });

  return readAdminEnvelope(response, "Nie udało się usunąć faktury.");
}

export async function resolveAdminOrderCancellation(args: {
  adminNote?: string;
  authToken: string;
  orderNumber: string;
  requestId: string;
  resolution: "cancel_order" | "decline_request";
}) {
  return adminJsonMutation({
    authToken: args.authToken,
    body: {
      adminNote: args.adminNote || null,
      requestId: args.requestId,
      resolution: args.resolution,
    },
    fallbackMessage: "Nie udało się obsłużyć anulowania.",
    method: "POST",
    path: orderPath(args.orderNumber, "/cancellation/resolve/"),
  });
}

export async function createAdminOrderReturnCase(args: {
  authToken: string;
  orderNumber: string;
  reason?: string;
}) {
  return adminJsonMutation<AdminReturnCaseMutationResult>({
    authToken: args.authToken,
    body: {
      reason: args.reason || null,
    },
    fallbackMessage: "Nie udało się utworzyć sprawy zwrotu.",
    method: "POST",
    path: orderPath(args.orderNumber, "/return-cases/"),
  });
}

export async function closeAdminOrderReturnCase(args: {
  authToken: string;
  orderNumber: string;
  returnCaseId: string;
}) {
  return adminJsonMutation<AdminReturnCaseMutationResult>({
    authToken: args.authToken,
    body: {},
    fallbackMessage: "Nie udało się zamknąć sprawy zwrotu.",
    method: "POST",
    path: orderPath(
      args.orderNumber,
      `/return-cases/${encodeURIComponent(args.returnCaseId)}/close/`,
    ),
  });
}

export async function markAdminOrderReturnCaseAwaitingGoods(args: {
  authToken: string;
  orderNumber: string;
  returnCaseId: string;
}) {
  return adminJsonMutation<AdminReturnCaseMutationResult>({
    authToken: args.authToken,
    body: {},
    fallbackMessage: "Nie udało się potwierdzić zwrotu.",
    method: "POST",
    path: orderPath(
      args.orderNumber,
      `/return-cases/${encodeURIComponent(args.returnCaseId)}/await-goods/`,
    ),
  });
}

export async function completeAdminOrderReturnCase(args: {
  adminNote?: string;
  authToken: string;
  orderNumber: string;
  returnCaseId: string;
}) {
  return adminJsonMutation<AdminReturnCaseMutationResult>({
    authToken: args.authToken,
    body: {
      adminNote: args.adminNote || null,
    },
    fallbackMessage: "Nie udało się zakończyć zwrotu.",
    method: "POST",
    path: orderPath(
      args.orderNumber,
      `/return-cases/${encodeURIComponent(args.returnCaseId)}/complete/`,
    ),
  });
}
