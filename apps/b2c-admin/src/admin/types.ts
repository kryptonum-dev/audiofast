export type AdminArea = "orders" | "coupons" | "analytics";

export type AdminOrderStatus =
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "returned";

export type AdminOrderLineType = "standard" | "cpo" | "mixed";

export type AdminOperationsFilter = "all" | "return" | "cancellation";

export type AdminDateRangeFilter = {
  from: string;
  to: string;
};

export type OrdersFilters = {
  search: string;
  status: AdminOrderStatus | "all";
  lineType: AdminOrderLineType | "all";
  dateRange: AdminDateRangeFilter;
  operations: AdminOperationsFilter;
};

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  currentStatus: AdminOrderStatus | string;
  createdAt: string;
  payableUntil: string;
  paidAt: string | null;
  customer: {
    displayName: string | null;
    email: string;
    phone: string | null;
  };
  grandTotalCents: number;
  discountTotalCents: number;
  itemSummary: {
    totalItemCount: number;
    lineTypes: string[];
    containsCpo: boolean;
    leadItem: {
      brandName: string;
      productName: string;
      productImage: {
        id?: string | null;
        preview?: string | null;
        alt?: string | null;
        naturalWidth?: number | null;
        naturalHeight?: number | null;
      } | null;
    } | null;
  };
  invoice: {
    hasInvoice: boolean;
    attachedAt: string | null;
    recipientType: "private" | "company" | "unknown";
  };
  shipment: {
    hasShipment: boolean;
    carrier: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
  };
  hasOpenCancellationRequest: boolean;
  hasOpenReturnCase: boolean;
};

export type AdminOrdersPagination = {
  page: number;
  limit: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  previousPage: number | null;
  nextPage: number | null;
  totalCount: number;
};

export type AdminOrdersResult = {
  orders: AdminOrderListItem[];
  pagination: AdminOrdersPagination;
  filters: unknown;
};

export type AdminApiSuccess<TData> = {
  ok: true;
  data: TData;
};

export type AdminApiFailure = {
  ok: false;
  error: string;
  message: string;
};

export type AdminApiEnvelope<TData> = AdminApiSuccess<TData> | AdminApiFailure;
