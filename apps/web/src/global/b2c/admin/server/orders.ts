import 'server-only';

import {
  buildOrderStatusTimeline,
  formatPersonName,
  getString,
  isRecord,
  type OrderAddressBlock,
  type ParsedOrderExpectedDeliveryEstimate,
  parseOrderDiscountData,
  parseOrderExpectedDeliveryEstimate,
  parseOrderInvoiceData,
  parseOrderItemSnapshot,
  parseOrderShipmentData,
  parseOrderShippingAddressSnapshot,
} from '@/src/global/b2c/utils/orders';
import {
  B2C_ORDER_STATUSES,
  type B2cOrderStatus,
  getAdminAllowedNextOrderStatusesForOrder,
  isB2cOrderStatus,
  isReturnEligibleOrderStatus,
  isWithinReturnWindow,
} from '@/src/global/b2c/utils/statuses';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

import { canEditDeliveryEstimate } from './order-delivery-estimate';
import {
  type AdminPagePagination,
  parseAdminPagePagination,
} from './pagination';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type ReturnCaseRow = Database['public']['Tables']['return_cases']['Row'];
type CancellationRequestRow =
  Database['public']['Tables']['order_cancellation_requests']['Row'];

type AdminOrderListRow = Pick<
  OrderRow,
  | 'created_at'
  | 'current_status'
  | 'customer_email'
  | 'customer_snapshot'
  | 'discount_total_cents'
  | 'grand_total_cents'
  | 'id'
  | 'invoice_data'
  | 'order_number'
  | 'paid_at'
  | 'payable_until'
  | 'shipment_data'
  | 'shipped_at'
> & {
  order_items?:
    | Pick<
        OrderItemRow,
        | 'brand_name'
        | 'item_snapshot'
        | 'line_position'
        | 'line_type'
        | 'product_name'
        | 'quantity'
      >[]
    | null;
  order_cancellation_requests?: Pick<CancellationRequestRow, 'id' | 'status'>[];
  return_cases?: Pick<ReturnCaseRow, 'id' | 'status'>[];
};

type AdminOrderDetailRow = Pick<
  OrderRow,
  | 'cancelled_at'
  | 'completed_at'
  | 'created_at'
  | 'current_status'
  | 'customer_email'
  | 'customer_snapshot'
  | 'discount_total_cents'
  | 'expected_delivery_from'
  | 'expected_delivery_to'
  | 'grand_total_cents'
  | 'id'
  | 'invoice_data'
  | 'order_number'
  | 'paid_at'
  | 'payable_until'
  | 'payment_provider'
  | 'payment_reference'
  | 'payment_verified_at'
  | 'returned_at'
  | 'shipment_data'
  | 'shipped_at'
  | 'shipping_address_snapshot'
  | 'status_history'
  | 'subtotal_cents'
  | 'updated_at'
  | 'used_discount'
>;

export type AdminOrderStatus = B2cOrderStatus;

export type AdminOrderLineTypeFilter = 'standard' | 'cpo' | 'mixed';

export type AdminOrderListFilters = {
  q: string | null;
  statuses: AdminOrderStatus[];
  lineType: AdminOrderLineTypeFilter | null;
  hasInvoice: boolean | null;
  hasShipment: boolean | null;
  hasOpenCancellationRequest: boolean | null;
  hasOpenReturnCase: boolean | null;
  createdFrom: string | null;
  createdTo: string | null;
  includeExpiredAwaitingPayment: boolean;
};

export type AdminOrderCustomerSummary = {
  displayName: string | null;
  email: string;
  phone: string | null;
};

export type AdminOrderListItemSummary = {
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

export type AdminOrderInvoiceSummary = {
  hasInvoice: boolean;
  filename: string | null;
  attachedAt: string | null;
  recipientType: 'private' | 'company' | 'unknown';
};

export type AdminOrderShipmentSummary = {
  hasShipment: boolean;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
};

export type AdminOrderDeliveryEstimate = ParsedOrderExpectedDeliveryEstimate;

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  currentStatus: string;
  createdAt: string;
  payableUntil: string;
  paidAt: string | null;
  customer: AdminOrderCustomerSummary;
  grandTotalCents: number;
  discountTotalCents: number;
  itemSummary: AdminOrderListItemSummary;
  invoice: AdminOrderInvoiceSummary;
  shipment: AdminOrderShipmentSummary;
  hasOpenCancellationRequest: boolean;
  hasOpenReturnCase: boolean;
};

export type AdminOrderListResult = {
  orders: AdminOrderListItem[];
  pagination: AdminPagePagination & {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    previousPage: number | null;
    nextPage: number | null;
    totalCount: number;
  };
  filters: AdminOrderListFilters;
};

export type AdminOrderAddressBlock = OrderAddressBlock;

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
  currentStatus: string;
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
  customer: AdminOrderCustomerSummary;
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
  deliveryEstimate: AdminOrderDeliveryEstimate | null;
  invoice: AdminOrderInvoiceSummary & {
    companyName: string | null;
    taxId: string | null;
    address: AdminOrderAddressBlock | null;
  };
  shipment: AdminOrderShipmentSummary | null;
  items: AdminOrderItem[];
  returnCases: AdminOrderReturnCase[];
  cancellationRequests: AdminOrderCancellationRequest[];
  latestCancellationRequest: AdminOrderCancellationRequest | null;
  timeline: AdminOrderTimelineEntry[];
  actions: {
    allowedNextStatuses: AdminOrderStatus[];
    canEditDeliveryEstimate: boolean;
    canEditShipment: boolean;
    canAttachInvoice: boolean;
    canResolveCancellationRequest: boolean;
    canCreateReturnCase: boolean;
  };
};

export type LoadAdminOrderDetailResult =
  | {
      kind: 'found';
      order: AdminOrderDetail;
    }
  | {
      kind: 'not_found';
    };

export class AdminOrderQueryError extends Error {
  readonly code = 'invalid_admin_order_query';
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'AdminOrderQueryError';
  }
}

const ADMIN_ORDER_LIST_SELECT =
  'id, order_number, current_status, payable_until, created_at, paid_at, customer_email, customer_snapshot, grand_total_cents, discount_total_cents, invoice_data, shipment_data, shipped_at, order_items(line_position, line_type, product_name, brand_name, quantity, item_snapshot), order_cancellation_requests(id, status), return_cases(id, status)';
const ADMIN_ORDER_DETAIL_SELECT =
  'cancelled_at, completed_at, created_at, current_status, customer_email, customer_snapshot, discount_total_cents, expected_delivery_from, expected_delivery_to, grand_total_cents, id, invoice_data, order_number, paid_at, payable_until, payment_provider, payment_reference, payment_verified_at, returned_at, shipment_data, shipped_at, shipping_address_snapshot, status_history, subtotal_cents, updated_at, used_discount';
const ADMIN_ORDER_STATUSES: AdminOrderStatus[] = [...B2C_ORDER_STATUSES];
const ADMIN_ORDER_LINE_TYPE_FILTER_SET = new Set<string>([
  'standard',
  'cpo',
  'mixed',
]);

function getBooleanSearchParam(value: string | null): boolean | null {
  if (!value) {
    return null;
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  throw new AdminOrderQueryError(`Invalid boolean query value: ${value}.`);
}

function parseCustomerSnapshot(
  value: Json,
  fallbackEmail: string,
): AdminOrderCustomerSummary {
  if (!isRecord(value)) {
    return {
      displayName: null,
      email: fallbackEmail,
      phone: null,
    };
  }

  return {
    displayName: formatPersonName(
      getString(value.firstName),
      getString(value.lastName),
    ),
    email: getString(value.email) ?? fallbackEmail,
    phone: getString(value.phone),
  };
}

function normalizeSearchValue(value: string): string {
  return value
    .replace(/[łŁ]/g, (letter) => (letter === 'Ł' ? 'L' : 'l'))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function customerSnapshotMatchesName(value: Json, query: string): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const queryValue = normalizeSearchValue(query);
  const names = [
    formatPersonName(getString(value.firstName), getString(value.lastName)),
    formatPersonName(getString(value.first_name), getString(value.last_name)),
    getString(value.name),
    getString(value.fullName),
    getString(value.full_name),
  ].filter(Boolean) as string[];

  return names.some((name) => normalizeSearchValue(name).includes(queryValue));
}

function parseInvoiceData(value: Json | null): AdminOrderDetail['invoice'] {
  const invoice = parseOrderInvoiceData(value);

  return {
    recipientType: invoice.recipientType,
    companyName: invoice.companyName,
    taxId: invoice.taxId,
    address: invoice.invoiceAddress,
    hasInvoice: invoice.storagePath !== null,
    filename: invoice.filename,
    attachedAt: invoice.attachedAt,
  };
}

function mapInvoiceSummary(value: Json | null): AdminOrderInvoiceSummary {
  const invoice = parseInvoiceData(value);

  return {
    hasInvoice: invoice.hasInvoice,
    filename: invoice.filename,
    attachedAt: invoice.attachedAt,
    recipientType: invoice.recipientType,
  };
}

function parseShipmentData(
  value: Json | null,
  shippedAt: string | null,
): AdminOrderShipmentSummary | null {
  const shipment = parseOrderShipmentData(value, shippedAt);

  if (!shipment) {
    return null;
  }

  return {
    hasShipment:
      shipment.carrier !== null ||
      shipment.trackingNumber !== null ||
      shipment.shippedAt !== null,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    shippedAt: shipment.shippedAt,
  };
}

function parseDiscountData(value: Json | null): AdminOrderDetail['discount'] {
  return parseOrderDiscountData(value);
}

function extractProductImage(
  value: Json,
): NonNullable<
  NonNullable<AdminOrderListItemSummary['leadItem']>['productImage']
> | null {
  if (!isRecord(value) || !isRecord(value.productImage)) {
    return null;
  }

  const image = value.productImage;
  const id = getString(image.id);

  if (!id) {
    return null;
  }

  return {
    id,
    preview: getString(image.preview),
    alt: getString(image.alt),
    naturalWidth:
      typeof image.naturalWidth === 'number' ? image.naturalWidth : null,
    naturalHeight:
      typeof image.naturalHeight === 'number' ? image.naturalHeight : null,
  };
}

function mapOrderItem(row: OrderItemRow): AdminOrderItem {
  const snapshot = parseOrderItemSnapshot(row.item_snapshot, row.line_type);

  return {
    id: row.id,
    lineType: row.line_type,
    linePosition: row.line_position,
    productKey: row.product_key,
    productName: row.product_name,
    brandName: row.brand_name,
    productImage: extractProductImage(row.item_snapshot),
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    lineSubtotalCents: row.line_subtotal_cents,
    lineDiscountTotalCents: row.line_discount_total_cents,
    lineTotalCents: row.line_total_cents,
    isReturnable: row.is_returnable,
    details: snapshot.details,
    cpoContext: snapshot.cpoContext,
  };
}

function mapItemSummary(
  items: AdminOrderListRow['order_items'],
): AdminOrderListItemSummary {
  const sortedItems = [...(items ?? [])].sort(
    (left, right) => left.line_position - right.line_position,
  );
  const lineTypes = Array.from(
    new Set(sortedItems.map((item) => item.line_type)),
  ).sort();
  const leadItem = sortedItems[0] ?? null;

  return {
    totalItemCount: sortedItems.reduce((sum, item) => sum + item.quantity, 0),
    lineTypes,
    containsCpo: lineTypes.includes('cpo'),
    leadItem: leadItem
      ? {
          brandName: leadItem.brand_name,
          productName: leadItem.product_name,
          productImage: extractProductImage(leadItem.item_snapshot),
        }
      : null,
  };
}

function hasOpenRelatedRows(
  rows:
    | Pick<ReturnCaseRow, 'id' | 'status'>[]
    | Pick<CancellationRequestRow, 'id' | 'status'>[]
    | null
    | undefined,
) {
  return (rows ?? []).some((row) => row.status === 'open');
}

export function mapAdminOrderListRow(
  row: AdminOrderListRow,
): AdminOrderListItem {
  const shipment = parseShipmentData(row.shipment_data, row.shipped_at);

  return {
    id: row.id,
    orderNumber: row.order_number,
    currentStatus: row.current_status,
    createdAt: row.created_at,
    payableUntil: row.payable_until,
    paidAt: row.paid_at,
    customer: parseCustomerSnapshot(row.customer_snapshot, row.customer_email),
    grandTotalCents: row.grand_total_cents,
    discountTotalCents: row.discount_total_cents,
    itemSummary: mapItemSummary(row.order_items),
    invoice: mapInvoiceSummary(row.invoice_data),
    shipment: shipment ?? {
      hasShipment: false,
      carrier: null,
      trackingNumber: null,
      shippedAt: null,
    },
    hasOpenCancellationRequest: hasOpenRelatedRows(
      row.order_cancellation_requests,
    ),
    hasOpenReturnCase: hasOpenRelatedRows(row.return_cases),
  };
}

function parseStatuses(searchParams: URLSearchParams): AdminOrderStatus[] {
  const values = searchParams
    .getAll('status')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return [];
  }

  const unknownStatus = values.find((value) => !isB2cOrderStatus(value));

  if (unknownStatus) {
    throw new AdminOrderQueryError(`Unknown order status: ${unknownStatus}.`);
  }

  return Array.from(new Set(values)) as AdminOrderStatus[];
}

function parseLineType(
  searchParams: URLSearchParams,
): AdminOrderLineTypeFilter | null {
  const value = searchParams.get('lineType')?.trim() ?? null;

  if (!value) {
    return null;
  }

  if (!ADMIN_ORDER_LINE_TYPE_FILTER_SET.has(value)) {
    throw new AdminOrderQueryError(`Unknown order line type filter: ${value}.`);
  }

  return value as AdminOrderLineTypeFilter;
}

export function parseAdminOrderListFilters(
  searchParams: URLSearchParams,
): AdminOrderListFilters {
  return {
    q: searchParams.get('q')?.trim() || null,
    statuses: parseStatuses(searchParams),
    lineType: parseLineType(searchParams),
    hasInvoice: getBooleanSearchParam(searchParams.get('hasInvoice')),
    hasShipment: getBooleanSearchParam(searchParams.get('hasShipment')),
    hasOpenCancellationRequest: getBooleanSearchParam(
      searchParams.get('hasOpenCancellationRequest'),
    ),
    hasOpenReturnCase: getBooleanSearchParam(
      searchParams.get('hasOpenReturnCase'),
    ),
    createdFrom: searchParams.get('createdFrom')?.trim() || null,
    createdTo: searchParams.get('createdTo')?.trim() || null,
    includeExpiredAwaitingPayment:
      getBooleanSearchParam(
        searchParams.get('includeExpiredAwaitingPayment'),
      ) ?? false,
  };
}

function buildVisibleStatusFilter(
  filters: AdminOrderListFilters,
  now: Date,
): string | null {
  if (filters.includeExpiredAwaitingPayment) {
    return null;
  }

  const requestedStatuses =
    filters.statuses.length > 0 ? filters.statuses : ADMIN_ORDER_STATUSES;
  const includesAwaitingPayment =
    requestedStatuses.includes('awaiting_payment');
  const nonAwaitingStatuses = requestedStatuses.filter(
    (status) => status !== 'awaiting_payment',
  );

  if (!includesAwaitingPayment) {
    return null;
  }

  const statusFilters = [
    nonAwaitingStatuses.length > 0
      ? `current_status.in.(${nonAwaitingStatuses.join(',')})`
      : null,
    `and(current_status.eq.awaiting_payment,payable_until.gt.${now.toISOString()})`,
  ].filter(Boolean);

  return statusFilters.join(',');
}

function hasOrderIdPreFilters(filters: AdminOrderListFilters): boolean {
  return (
    filters.lineType !== null ||
    filters.hasInvoice !== null ||
    filters.hasShipment !== null ||
    filters.hasOpenCancellationRequest !== null ||
    filters.hasOpenReturnCase !== null
  );
}

function intersectOrderIds(
  current: Set<string> | null,
  next: Set<string>,
): Set<string> {
  if (!current) {
    return next;
  }

  return new Set([...current].filter((id) => next.has(id)));
}

async function loadAllOrderIds(): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('orders').select('id');

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.id));
}

async function resolveLineTypeOrderIds(
  lineType: AdminOrderLineTypeFilter,
): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, line_type');

  if (error) {
    throw error;
  }

  const lineTypesByOrderId = new Map<string, Set<string>>();

  for (const row of data ?? []) {
    const orderLineTypes = lineTypesByOrderId.get(row.order_id) ?? new Set();

    orderLineTypes.add(row.line_type);
    lineTypesByOrderId.set(row.order_id, orderLineTypes);
  }

  const matchingIds = new Set<string>();

  for (const [orderId, lineTypes] of lineTypesByOrderId.entries()) {
    if (
      lineType === 'standard' &&
      lineTypes.size === 1 &&
      lineTypes.has('standard')
    ) {
      matchingIds.add(orderId);
    }

    if (lineType === 'cpo' && lineTypes.size === 1 && lineTypes.has('cpo')) {
      matchingIds.add(orderId);
    }

    if (
      lineType === 'mixed' &&
      lineTypes.has('standard') &&
      lineTypes.has('cpo')
    ) {
      matchingIds.add(orderId);
    }
  }

  return matchingIds;
}

async function resolveInvoiceAndShipmentOrderIds(args: {
  hasInvoice: boolean | null;
  hasShipment: boolean | null;
}): Promise<Set<string> | null> {
  if (args.hasInvoice === null && args.hasShipment === null) {
    return null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, invoice_data, shipment_data, shipped_at');

  if (error) {
    throw error;
  }

  const matchingIds = new Set<string>();

  for (const row of data ?? []) {
    const invoice = mapInvoiceSummary(row.invoice_data);
    const shipment = parseShipmentData(row.shipment_data, row.shipped_at);
    const hasShipment = shipment?.hasShipment ?? false;

    if (
      (args.hasInvoice === null || invoice.hasInvoice === args.hasInvoice) &&
      (args.hasShipment === null || hasShipment === args.hasShipment)
    ) {
      matchingIds.add(row.id);
    }
  }

  return matchingIds;
}

async function resolveOpenRelatedOrderIds(args: {
  allOrderIds: Set<string>;
  expected: boolean;
  table: 'order_cancellation_requests' | 'return_cases';
}): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(args.table)
    .select('order_id')
    .eq('status', 'open');

  if (error) {
    throw error;
  }

  const openOrderIds = new Set((data ?? []).map((row) => row.order_id));

  if (args.expected) {
    return openOrderIds;
  }

  return new Set([...args.allOrderIds].filter((id) => !openOrderIds.has(id)));
}

async function resolveCustomerNameOrderIds(
  query: string,
): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, customer_snapshot');

  if (error) {
    throw error;
  }

  return new Set(
    (data ?? [])
      .filter((row) =>
        customerSnapshotMatchesName(row.customer_snapshot, query),
      )
      .map((row) => row.id),
  );
}

async function resolveAdminOrderIdPreFilter(
  filters: AdminOrderListFilters,
): Promise<Set<string> | null> {
  if (!hasOrderIdPreFilters(filters)) {
    return null;
  }

  let matchingIds: Set<string> | null = null;
  let allOrderIds: Set<string> | null = null;

  if (filters.lineType) {
    matchingIds = intersectOrderIds(
      matchingIds,
      await resolveLineTypeOrderIds(filters.lineType),
    );
  }

  const invoiceAndShipmentIds = await resolveInvoiceAndShipmentOrderIds({
    hasInvoice: filters.hasInvoice,
    hasShipment: filters.hasShipment,
  });

  if (invoiceAndShipmentIds) {
    matchingIds = intersectOrderIds(matchingIds, invoiceAndShipmentIds);
  }

  if (filters.hasOpenCancellationRequest !== null) {
    allOrderIds ??= await loadAllOrderIds();
    matchingIds = intersectOrderIds(
      matchingIds,
      await resolveOpenRelatedOrderIds({
        allOrderIds,
        expected: filters.hasOpenCancellationRequest,
        table: 'order_cancellation_requests',
      }),
    );
  }

  if (filters.hasOpenReturnCase !== null) {
    allOrderIds ??= await loadAllOrderIds();
    matchingIds = intersectOrderIds(
      matchingIds,
      await resolveOpenRelatedOrderIds({
        allOrderIds,
        expected: filters.hasOpenReturnCase,
        table: 'return_cases',
      }),
    );
  }

  return matchingIds ?? new Set();
}

export function getAdminAllowedNextStatuses(args: {
  currentStatus: string;
  now: Date;
  shippedAt: string | null;
}): AdminOrderStatus[] {
  return getAdminAllowedNextOrderStatusesForOrder(args);
}

function buildStatusTimeline(
  row: AdminOrderDetailRow,
): AdminOrderTimelineEntry[] {
  return buildOrderStatusTimeline(row, {
    fallbackSource: (status) =>
      status === 'awaiting_payment' ||
      status === 'awaiting_confirmation' ||
      status === 'paid'
        ? 'system'
        : 'admin',
  }).map((entry) => ({
    ...entry,
    source: entry.source ?? 'unknown',
  }));
}

function mapReturnCase(row: ReturnCaseRow): AdminOrderReturnCase {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    completedAt: row.completed_at,
  };
}

function mapCancellationRequest(
  row: CancellationRequestRow,
): AdminOrderCancellationRequest {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    adminNote: row.admin_note,
    requestedAt: row.requested_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  };
}

function canCreateReturnCase(args: {
  order: AdminOrderDetailRow;
  items: AdminOrderItem[];
  invoice: AdminOrderDetail['invoice'];
  returnCases: AdminOrderReturnCase[];
  now: Date;
}) {
  const returnStatusEligible = isReturnEligibleOrderStatus(
    args.order.current_status,
  );
  const allItemsReturnable =
    args.items.length > 0 && args.items.every((item) => item.isReturnable);
  const hasOpenReturnCase = args.returnCases.some(
    (returnCase) => returnCase.status === 'open',
  );

  return (
    returnStatusEligible &&
    allItemsReturnable &&
    !hasOpenReturnCase &&
    args.invoice.recipientType !== 'company' &&
    isWithinReturnWindow({
      now: args.now,
      shippedAt: args.order.shipped_at,
    })
  );
}

function mapAdminOrderDetail(args: {
  row: AdminOrderDetailRow;
  items: OrderItemRow[];
  returnCases: ReturnCaseRow[];
  cancellationRequests: CancellationRequestRow[];
  now: Date;
}): AdminOrderDetail {
  const customer = parseCustomerSnapshot(
    args.row.customer_snapshot,
    args.row.customer_email,
  );
  const shippingAddress = parseOrderShippingAddressSnapshot(
    args.row.shipping_address_snapshot,
  );
  const items = args.items
    .map(mapOrderItem)
    .sort((left, right) => left.linePosition - right.linePosition);
  const invoice = parseInvoiceData(args.row.invoice_data);
  const returnCases = args.returnCases
    .map(mapReturnCase)
    .sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    );
  const latestCancellationRequest =
    [...args.cancellationRequests]
      .sort(
        (left, right) =>
          Date.parse(right.requested_at) - Date.parse(left.requested_at),
      )
      .map(mapCancellationRequest)[0] ?? null;
  const shipment = parseShipmentData(
    args.row.shipment_data,
    args.row.shipped_at,
  );

  return {
    id: args.row.id,
    orderNumber: args.row.order_number,
    currentStatus: args.row.current_status,
    createdAt: args.row.created_at,
    updatedAt: args.row.updated_at,
    payableUntil: args.row.payable_until,
    paidAt: args.row.paid_at,
    shippedAt: args.row.shipped_at,
    completedAt: args.row.completed_at,
    cancelledAt: args.row.cancelled_at,
    returnedAt: args.row.returned_at,
    payment: {
      provider: args.row.payment_provider,
      reference: args.row.payment_reference,
      verifiedAt: args.row.payment_verified_at,
    },
    customer,
    shippingAddress: {
      ...shippingAddress,
      phone: shippingAddress.phone ?? customer.phone,
    },
    subtotalCents: args.row.subtotal_cents,
    discountTotalCents: args.row.discount_total_cents,
    grandTotalCents: args.row.grand_total_cents,
    discount: parseDiscountData(args.row.used_discount),
    deliveryEstimate: parseOrderExpectedDeliveryEstimate(
      args.row.expected_delivery_from,
      args.row.expected_delivery_to,
    ),
    invoice,
    shipment,
    items,
    returnCases,
    cancellationRequests: [...args.cancellationRequests]
      .sort(
        (left, right) =>
          Date.parse(right.requested_at) - Date.parse(left.requested_at),
      )
      .map(mapCancellationRequest),
    latestCancellationRequest,
    timeline: buildStatusTimeline(args.row),
    actions: {
      allowedNextStatuses: getAdminAllowedNextStatuses({
        currentStatus: args.row.current_status,
        now: args.now,
        shippedAt: args.row.shipped_at,
      }),
      canEditDeliveryEstimate: canEditDeliveryEstimate(args.row.current_status),
      canEditShipment:
        args.row.current_status !== 'cancelled' &&
        args.row.current_status !== 'returned',
      canAttachInvoice: args.row.current_status !== 'awaiting_payment',
      canResolveCancellationRequest:
        latestCancellationRequest?.status === 'open',
      canCreateReturnCase: canCreateReturnCase({
        order: args.row,
        items,
        invoice,
        returnCases,
        now: args.now,
      }),
    },
  };
}

export async function loadAdminOrders(input: {
  searchParams: URLSearchParams;
  now?: Date;
}): Promise<AdminOrderListResult> {
  const now = input.now ?? new Date();
  const pagination = parseAdminPagePagination(input.searchParams);
  const filters = parseAdminOrderListFilters(input.searchParams);
  const filteredOrderIds = await resolveAdminOrderIdPreFilter(filters);
  const safeOffset = (pagination.page - 1) * pagination.limit;
  const rangeEnd = safeOffset + pagination.limit - 1;

  if (filteredOrderIds && filteredOrderIds.size === 0) {
    return {
      orders: [],
      pagination: {
        ...pagination,
        currentPage: pagination.page,
        pageSize: pagination.limit,
        totalPages: 0,
        previousPage: pagination.page > 1 ? pagination.page - 1 : null,
        nextPage: null,
        totalCount: 0,
      },
      filters,
    };
  }

  const supabase = createAdminClient();
  let query = supabase
    .from('orders')
    .select(ADMIN_ORDER_LIST_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filteredOrderIds) {
    query = query.in('id', [...filteredOrderIds]);
  }

  if (filters.q) {
    const customerNameOrderIds = await resolveCustomerNameOrderIds(filters.q);
    const searchFilters = [
      `order_number.ilike.%${filters.q}%`,
      `customer_email.ilike.%${filters.q}%`,
      customerNameOrderIds.size > 0
        ? `id.in.(${[...customerNameOrderIds].join(',')})`
        : null,
    ].filter(Boolean);

    query = query.or(searchFilters.join(','));
  }

  const visibleStatusFilter = buildVisibleStatusFilter(filters, now);

  if (visibleStatusFilter) {
    query = query.or(visibleStatusFilter);
  } else if (filters.statuses.length > 0) {
    query = query.in('current_status', filters.statuses);
  }

  if (filters.createdFrom) {
    query = query.gte('created_at', filters.createdFrom);
  }

  if (filters.createdTo) {
    query = query.lte('created_at', filters.createdTo);
  }

  query = query.range(safeOffset, rangeEnd);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const orders = ((data ?? []) as unknown as AdminOrderListRow[]).map(
    mapAdminOrderListRow,
  );
  const totalCount = count ?? orders.length;
  const totalPages = Math.ceil(totalCount / pagination.limit);

  return {
    orders,
    pagination: {
      ...pagination,
      currentPage: pagination.page,
      pageSize: pagination.limit,
      totalPages,
      previousPage: pagination.page > 1 ? pagination.page - 1 : null,
      nextPage: pagination.page < totalPages ? pagination.page + 1 : null,
      totalCount,
    },
    filters,
  };
}

async function loadOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('line_position', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as OrderItemRow[];
}

async function loadReturnCases(orderId: string): Promise<ReturnCaseRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('return_cases')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ReturnCaseRow[];
}

async function loadCancellationRequests(
  orderId: string,
): Promise<CancellationRequestRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_cancellation_requests')
    .select('*')
    .eq('order_id', orderId)
    .order('requested_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as CancellationRequestRow[];
}

export async function loadAdminOrderDetail(input: {
  orderNumber: string;
  now?: Date;
}): Promise<LoadAdminOrderDetailResult> {
  const now = input.now ?? new Date();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(ADMIN_ORDER_DETAIL_SELECT)
    .eq('order_number', input.orderNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as AdminOrderDetailRow | null;

  if (!row) {
    return { kind: 'not_found' };
  }

  const [items, returnCases, cancellationRequests] = await Promise.all([
    loadOrderItems(row.id),
    loadReturnCases(row.id),
    loadCancellationRequests(row.id),
  ]);

  return {
    kind: 'found',
    order: mapAdminOrderDetail({
      row,
      items,
      returnCases,
      cancellationRequests,
      now,
    }),
  };
}

export const adminOrderTesting = {
  customerSnapshotMatchesName,
  getAllowedNextStatuses: (status: string) =>
    getAdminAllowedNextStatuses({
      currentStatus: status,
      now: new Date('2026-05-06T08:00:00.000Z'),
      shippedAt: '2026-05-01T08:00:00.000Z',
    }),
  getAllowedNextStatusesForOrder: getAdminAllowedNextStatuses,
  mapAdminOrderListRow,
  parseAdminOrderListFilters,
};
