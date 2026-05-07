export type AdminArea = "orders" | "coupons" | "analytics";

export type AdminCouponDerivedStatus =
  | "active"
  | "expired"
  | "inactive"
  | "scheduled"
  | "usage_limit_reached";

export type AdminCouponDiscountType =
  | "fixed_order"
  | "fixed_product"
  | "percent_order"
  | "percent_product";

export type CouponsFilters = {
  search: string;
  status: AdminCouponDerivedStatus | "all";
  discountType: AdminCouponDiscountType | "all";
};

export type AdminCoupon = {
  id: string;
  code: string;
  isActive: boolean;
  discountType: AdminCouponDiscountType | string;
  discountValueCents: number | null;
  discountPercent: number | null;
  productKeys: string[];
  usageLimit: number | null;
  usageCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  derivedStatus: AdminCouponDerivedStatus | string;
};

export type AdminCouponsPagination = {
  cursor: string | null;
  limit: number;
  nextCursor: string | null;
  total: number;
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminCouponsResult = {
  coupons: AdminCoupon[];
  pagination: AdminCouponsPagination;
};

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
    filename: string | null;
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

export type AdminOrderAddressBlock = {
  companyName: string | null;
  recipientName: string | null;
  phone: string | null;
  taxId: string | null;
  lines: string[];
};

export type AdminOrderItem = {
  id: string;
  lineType: string;
  linePosition: number;
  productKey: string;
  productName: string;
  brandName: string;
  productImage: {
    id?: string | null;
    preview?: string | null;
    alt?: string | null;
    naturalWidth?: number | null;
    naturalHeight?: number | null;
  } | null;
  quantity: number;
  unitPriceCents: number;
  lineSubtotalCents: number;
  lineDiscountTotalCents: number;
  lineTotalCents: number;
  isReturnable: boolean;
  details: string[];
  cpoContext: {
    availabilityStatusAtPurchase: string | null;
    archivedAtPurchase: boolean | null;
  } | null;
};

export type AdminOrderTimelineEntry = {
  id: string;
  status: string;
  changedAt: string;
  source: string;
  previousStatus: string | null;
  actor: string | null;
  actorEmail: string | null;
  actorImage: string | null;
  actorName: string | null;
  note: string | null;
};

export type AdminOrderReturnCase = {
  id: string;
  status: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  completedAt: string | null;
};

export type AdminOrderCancellationRequest = {
  id: string;
  status: string;
  reason: string | null;
  adminNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  currentStatus: AdminOrderStatus | string;
  createdAt: string;
  updatedAt: string;
  payableUntil: string;
  paidAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  returnedAt: string | null;
  payment: {
    provider: string;
    reference: string | null;
    verifiedAt: string | null;
  };
  customer: AdminOrderListItem["customer"];
  shippingAddress: AdminOrderAddressBlock;
  subtotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
  discount: {
    couponCode: string | null;
    discountType: string | null;
    discountValueCents: number | null;
    discountPercent: number | null;
    totalDiscountCents: number;
  } | null;
  invoice: AdminOrderListItem["invoice"] & {
    companyName: string | null;
    taxId: string | null;
    address: AdminOrderAddressBlock | null;
  };
  shipment: AdminOrderListItem["shipment"] | null;
  items: AdminOrderItem[];
  returnCases: AdminOrderReturnCase[];
  cancellationRequests: AdminOrderCancellationRequest[];
  latestCancellationRequest: AdminOrderCancellationRequest | null;
  timeline: AdminOrderTimelineEntry[];
  actions: {
    allowedNextStatuses: AdminOrderStatus[];
    canEditShipment: boolean;
    canAttachInvoice: boolean;
    canResolveCancellationRequest: boolean;
    canCreateReturnCase: boolean;
  };
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
