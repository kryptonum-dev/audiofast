import 'server-only';

import type { SanityRawImage } from '@/src/components/shared/Image';
import {
  canReceiveB2cWithdrawalForm,
  hasB2cWithdrawalFormDocument,
  loadB2cWithdrawalFormDocument,
} from '@/src/global/b2c/legal-documents/withdrawal-form';
import {
  buildOrderStatusTimeline,
  formatPersonName,
  getString,
  isRecord,
  type OrderAddressBlock,
  type ParsedOrderExpectedDeliveryEstimate,
  type ParsedOrderInvoiceData,
  parseOrderDiscountData,
  parseOrderExpectedDeliveryEstimate,
  parseOrderInvoiceData,
  parseOrderItemSnapshot,
  parseOrderShipmentData,
  parseOrderShippingAddressSnapshot,
} from '@/src/global/b2c/utils/orders';
import {
  isCancellableOrderStatus,
  isReturnEligibleOrderStatus,
  isWithinReturnWindow,
} from '@/src/global/b2c/utils/statuses';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

import {
  classifyCustomerAuthOrderAccess,
  type CustomerAuthOrderAccessKind,
  isEligibleCustomerAuthOrderAccessKind,
} from '../eligibility';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type ReturnCaseRow = Database['public']['Tables']['return_cases']['Row'];
type CancellationRequestRow =
  Database['public']['Tables']['order_cancellation_requests']['Row'];

type CustomerOrderDetailRow = Pick<
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
  | 'payment_reference'
  | 'payment_verified_at'
  | 'returned_at'
  | 'shipment_data'
  | 'shipped_at'
  | 'shipping_address_snapshot'
  | 'status_history'
  | 'subtotal_cents'
  | 'used_discount'
  | 'updated_at'
>;

export type CustomerOrderAddressBlock = OrderAddressBlock;

export type CustomerOrderContactSnapshot = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
};

export type CustomerOrderInvoiceSnapshot = {
  recipientType: 'private' | 'company' | 'unknown';
  companyName: string | null;
  taxId: string | null;
  address: CustomerOrderAddressBlock | null;
  hasDocument: boolean;
  attachedAt: string | null;
  downloadHref: string | null;
  withdrawalFormDownloadHref: string | null;
};

export type CustomerOrderDiscountSnapshot = {
  couponCode: string | null;
  discountType: string | null;
  discountValueLabel: string | null;
  totalDiscountCents: number;
};

export type CustomerOrderShipmentSnapshot = {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
};

export type CustomerOrderDeliveryEstimate = ParsedOrderExpectedDeliveryEstimate;

export type CustomerOrderDetailItem = {
  id: string;
  lineType: string;
  linePosition: number;
  productKey: string;
  productName: string;
  brandName: string;
  quantity: number;
  unitPriceCents: number;
  lineSubtotalCents: number;
  lineDiscountTotalCents: number;
  lineTotalCents: number;
  isReturnable: boolean;
  productImage: SanityRawImage | null;
  details: string[];
  cpoContext: string | null;
};

export type CustomerOrderTimelineEntry = {
  id: string;
  status: string;
  changedAt: string;
  sourceLabel: string;
};

export type CustomerOrderReturnCaseSummary = {
  status: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  awaitingGoodsAt: string | null;
  acknowledgmentSentAt: string | null;
  instructionsSentAt: string | null;
  completedAt: string | null;
  closedAt: string | null;
};

export type CustomerOrderCancellationRequestSummary = {
  status: string;
  reason: string | null;
  adminNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
};

export type CustomerOrderActionEligibility = {
  canCancel: boolean;
  canRequestReturn: boolean;
  cancelMessage: string;
  returnMessage: string;
};

export type CustomerOrderDetail = {
  id: string;
  orderNumber: string;
  currentStatus: string;
  accessKind: CustomerAuthOrderAccessKind;
  createdAt: string;
  payableUntil: string;
  paidAt: string | null;
  paymentReference: string | null;
  paymentVerifiedAt: string | null;
  subtotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
  customer: CustomerOrderContactSnapshot;
  shippingAddress: CustomerOrderAddressBlock;
  invoice: CustomerOrderInvoiceSnapshot;
  discount: CustomerOrderDiscountSnapshot | null;
  deliveryEstimate: CustomerOrderDeliveryEstimate | null;
  shipment: CustomerOrderShipmentSnapshot | null;
  items: CustomerOrderDetailItem[];
  timeline: CustomerOrderTimelineEntry[];
  activeReturnCase: CustomerOrderReturnCaseSummary | null;
  returnCases: CustomerOrderReturnCaseSummary[];
  cancellationRequest: CustomerOrderCancellationRequestSummary | null;
  cancellationRequests: CustomerOrderCancellationRequestSummary[];
  actions: CustomerOrderActionEligibility;
};

export type LoadCustomerOrderForPanelInput = {
  orderNumber: string;
  normalizedEmail: string;
  now?: Date;
};

export type LoadCustomerOrderForPanelResult =
  | {
      kind: 'found';
      order: CustomerOrderDetail;
    }
  | {
      kind: 'not_found';
    };

type ParsedInvoiceData = ParsedOrderInvoiceData;

const CUSTOMER_ORDER_DETAIL_SELECT =
  'cancelled_at, completed_at, created_at, current_status, customer_email, customer_snapshot, discount_total_cents, expected_delivery_from, expected_delivery_to, grand_total_cents, id, invoice_data, order_number, paid_at, payable_until, payment_reference, payment_verified_at, returned_at, shipment_data, shipped_at, shipping_address_snapshot, status_history, subtotal_cents, used_discount, updated_at';

const INVOICE_SIGNED_URL_TTL_SECONDS = 60;
const INVOICE_STORAGE_BUCKET =
  process.env.SUPABASE_ORDER_INVOICES_BUCKET ?? 'order-invoices';

function parseCustomerSnapshot(value: Json): CustomerOrderContactSnapshot {
  if (!isRecord(value)) {
    return {
      fullName: null,
      email: null,
      phone: null,
    };
  }

  return {
    fullName: formatPersonName(
      getString(value.firstName),
      getString(value.lastName),
    ),
    email: getString(value.email),
    phone: getString(value.phone),
  };
}

function mapInvoiceData(
  orderNumber: string,
  invoiceData: ParsedInvoiceData,
  hasWithdrawalFormDocument: boolean,
): CustomerOrderInvoiceSnapshot {
  const hasDocument = invoiceData.storagePath !== null;
  const canDownloadWithdrawalForm =
    hasDocument &&
    hasWithdrawalFormDocument &&
    canReceiveB2cWithdrawalForm(invoiceData);

  return {
    recipientType: invoiceData.recipientType,
    companyName: invoiceData.companyName,
    taxId: invoiceData.taxId,
    address: invoiceData.invoiceAddress,
    hasDocument,
    attachedAt: invoiceData.attachedAt,
    downloadHref: hasDocument
      ? `/konto-klienta/zamowienia/${orderNumber}/faktura/`
      : null,
    withdrawalFormDownloadHref: canDownloadWithdrawalForm
      ? `/konto-klienta/zamowienia/${orderNumber}/formularz-odstapienia/`
      : null,
  };
}

function parseDiscountData(
  value: Json | null,
): CustomerOrderDiscountSnapshot | null {
  const discount = parseOrderDiscountData(value);

  if (!discount) {
    return null;
  }

  const discountValueLabel =
    discount.discountValueCents !== null
      ? `${Math.round(discount.discountValueCents / 100)} PLN`
      : discount.discountPercent !== null
        ? `${discount.discountPercent}%`
        : null;

  return {
    couponCode: discount.couponCode,
    discountType: discount.discountType,
    discountValueLabel,
    totalDiscountCents: discount.totalDiscountCents,
  };
}

function extractProductImage(snapshot: Json): SanityRawImage | null {
  if (!isRecord(snapshot)) {
    return null;
  }

  const candidate = snapshot.productImage;

  if (!isRecord(candidate)) {
    return null;
  }

  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null;
  }

  return candidate as unknown as SanityRawImage;
}

function mapOrderItem(row: OrderItemRow): CustomerOrderDetailItem {
  const snapshot = parseOrderItemSnapshot(row.item_snapshot, row.line_type);
  let cpoContext: string | null = null;

  if (snapshot.cpoContext) {
    const cpoDetails = [
      snapshot.cpoContext.availabilityStatusAtPurchase
        ? `Status CPO: ${snapshot.cpoContext.availabilityStatusAtPurchase}`
        : null,
      snapshot.cpoContext.archivedAtPurchase !== null
        ? snapshot.cpoContext.archivedAtPurchase
          ? 'Archiwalne w momencie zakupu'
          : 'Aktywne w momencie zakupu'
        : null,
    ].filter(Boolean);

    cpoContext = cpoDetails.length > 0 ? cpoDetails.join(' / ') : null;
  }

  return {
    id: row.id,
    lineType: row.line_type,
    linePosition: row.line_position,
    productKey: row.product_key,
    productName: row.product_name,
    brandName: row.brand_name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    lineSubtotalCents: row.line_subtotal_cents,
    lineDiscountTotalCents: row.line_discount_total_cents,
    lineTotalCents: row.line_total_cents,
    isReturnable: row.is_returnable,
    productImage: extractProductImage(row.item_snapshot),
    details: snapshot.details,
    cpoContext,
  };
}

function resolveTimelineSourceLabel(source: unknown): string {
  if (source === 'system') {
    return 'System Audiofast';
  }
  if (source === 'admin' || source === 'operator') {
    return 'Aktualizacja Audiofast';
  }
  return 'Audiofast';
}

function buildStatusTimeline(
  row: CustomerOrderDetailRow,
): CustomerOrderTimelineEntry[] {
  return buildOrderStatusTimeline(row, {
    fallbackSource: (status) =>
      status === 'awaiting_payment' ||
      status === 'awaiting_confirmation' ||
      status === 'paid'
        ? 'system'
        : null,
  }).map((entry) => ({
    id: entry.id,
    status: entry.status,
    changedAt: entry.changedAt,
    sourceLabel: resolveTimelineSourceLabel(entry.source),
  }));
}

function mapReturnCase(row: ReturnCaseRow): CustomerOrderReturnCaseSummary {
  return {
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    awaitingGoodsAt: row.awaiting_goods_at,
    acknowledgmentSentAt: row.acknowledgment_sent_at,
    instructionsSentAt: row.instructions_sent_at,
    completedAt: row.completed_at,
    closedAt: row.closed_at,
  };
}

function findActiveReturnCase(
  rows: ReturnCaseRow[],
): CustomerOrderReturnCaseSummary | null {
  const activeCase = rows.find(
    (row) => row.status === 'open' || row.status === 'awaiting_goods',
  );

  return activeCase ? mapReturnCase(activeCase) : null;
}

function mapCancellationRequest(
  row: CancellationRequestRow,
): CustomerOrderCancellationRequestSummary {
  return {
    status: row.status,
    reason: row.reason,
    adminNote: row.admin_note,
    requestedAt: row.requested_at,
    resolvedAt: row.resolved_at,
  };
}

function buildActionEligibility(args: {
  row: CustomerOrderDetailRow;
  items: CustomerOrderDetailItem[];
  invoice: ParsedInvoiceData;
  activeReturnCase: CustomerOrderReturnCaseSummary | null;
  cancellationRequest: CustomerOrderCancellationRequestSummary | null;
  now: Date;
}): CustomerOrderActionEligibility {
  const canCancel =
    isCancellableOrderStatus(args.row.current_status) &&
    args.cancellationRequest?.status !== 'open';
  const allItemsReturnable =
    args.items.length > 0 && args.items.every((item) => item.isReturnable);
  const returnStatusEligible = isReturnEligibleOrderStatus(
    args.row.current_status,
  );
  const withinReturnWindow = isWithinReturnWindow({
    now: args.now,
    shippedAt: args.row.shipped_at,
  });
  const isCompanyInvoice = args.invoice.recipientType === 'company';
  const canRequestReturn =
    returnStatusEligible &&
    allItemsReturnable &&
    withinReturnWindow &&
    !isCompanyInvoice &&
    args.activeReturnCase === null;

  let returnMessage =
    'Zwrot będzie możliwy po wysyłce, jeżeli zamówienie spełnia warunki zwrotu.';

  if (args.activeReturnCase) {
    returnMessage =
      args.activeReturnCase.status === 'awaiting_goods'
        ? 'Audiofast potwierdził zwrot. Sprawdź wiadomość e-mail z instrukcją odesłania towaru.'
        : 'Zgłoszenie zwrotu zostało wysłane. Audiofast sprawdzi je i wyśle dalsze instrukcje po potwierdzeniu.';
  } else if (!returnStatusEligible) {
    returnMessage =
      'Zwrot można rozpocząć po wysyłce lub zakończeniu realizacji zamówienia.';
  } else if (!allItemsReturnable) {
    returnMessage =
      'To zamówienie zawiera produkt bez prawa zwrotu, dlatego samoobsługowy zwrot jest niedostępny.';
  } else if (isCompanyInvoice) {
    returnMessage =
      'Zakup z danymi firmowymi może wyłączać samoobsługowy zwrot w panelu.';
  } else if (!withinReturnWindow) {
    returnMessage = 'Okno zwrotu dla tego zamówienia nie jest już aktywne.';
  } else if (canRequestReturn) {
    returnMessage =
      'Zamówienie mieści się w oknie zwrotu. Możesz wysłać prośbę o rozpoczęcie obsługi zwrotu.';
  }

  let cancelMessage =
    'Anulowanie jest dostępne tylko dla zamówień opłaconych lub w realizacji, przed wysyłką.';

  if (args.cancellationRequest?.status === 'open') {
    cancelMessage =
      'Prośba o anulowanie została wysłana. Audiofast sprawdzi, czy zamówienie można jeszcze zatrzymać.';
  } else if (
    args.cancellationRequest?.status === 'rejected' ||
    args.cancellationRequest?.status === 'declined'
  ) {
    cancelMessage =
      'Audiofast odrzucił prośbę o anulowanie. Zamówienie pozostaje w realizacji.';
  } else if (args.row.current_status === 'cancelled') {
    cancelMessage = 'Zamówienie zostało anulowane.';
  } else if (canCancel) {
    cancelMessage =
      'Możesz poprosić o anulowanie zamówienia przed wysyłką. Audiofast potwierdzi, czy anulowanie jest jeszcze możliwe.';
  }

  return {
    canCancel,
    canRequestReturn,
    cancelMessage,
    returnMessage,
  };
}

function mapCustomerOrderDetail(args: {
  hasWithdrawalFormDocument: boolean;
  row: CustomerOrderDetailRow;
  items: OrderItemRow[];
  returnCases: ReturnCaseRow[];
  cancellationRequests: CancellationRequestRow[];
  now: Date;
}): CustomerOrderDetail {
  const accessKind = classifyCustomerAuthOrderAccess(args.row, args.now);
  const invoiceData = parseOrderInvoiceData(args.row.invoice_data);
  const items = args.items
    .map(mapOrderItem)
    .sort((left, right) => left.linePosition - right.linePosition);
  const returnCases = args.returnCases.map(mapReturnCase);
  const activeReturnCase = findActiveReturnCase(args.returnCases);
  const cancellationRequests = args.cancellationRequests.map(
    mapCancellationRequest,
  );
  const activeCancellationRequest =
    cancellationRequests.find((request) => request.status === 'open') ??
    cancellationRequests[0] ??
    null;

  return {
    id: args.row.id,
    orderNumber: args.row.order_number,
    currentStatus: args.row.current_status,
    accessKind,
    createdAt: args.row.created_at,
    payableUntil: args.row.payable_until,
    paidAt: args.row.paid_at,
    paymentReference: args.row.payment_reference,
    paymentVerifiedAt: args.row.payment_verified_at,
    subtotalCents: args.row.subtotal_cents,
    discountTotalCents: args.row.discount_total_cents,
    grandTotalCents: args.row.grand_total_cents,
    customer: parseCustomerSnapshot(args.row.customer_snapshot),
    shippingAddress: parseOrderShippingAddressSnapshot(
      args.row.shipping_address_snapshot,
    ),
    invoice: mapInvoiceData(
      args.row.order_number,
      invoiceData,
      args.hasWithdrawalFormDocument,
    ),
    discount: parseDiscountData(args.row.used_discount),
    deliveryEstimate: parseOrderExpectedDeliveryEstimate(
      args.row.expected_delivery_from,
      args.row.expected_delivery_to,
    ),
    shipment: parseOrderShipmentData(
      args.row.shipment_data,
      args.row.shipped_at,
    ),
    items,
    timeline: buildStatusTimeline(args.row),
    activeReturnCase,
    returnCases,
    cancellationRequest: activeCancellationRequest,
    cancellationRequests,
    actions: buildActionEligibility({
      row: args.row,
      items,
      invoice: invoiceData,
      activeReturnCase,
      cancellationRequest: activeCancellationRequest,
      now: args.now,
    }),
  };
}

async function loadOwnedVisibleOrderRow(args: {
  orderNumber: string;
  normalizedEmail: string;
  now: Date;
}): Promise<CustomerOrderDetailRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(CUSTOMER_ORDER_DETAIL_SELECT)
    .eq('order_number', args.orderNumber)
    .ilike('customer_email', args.normalizedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as CustomerOrderDetailRow | null;

  if (!row) {
    return null;
  }

  const accessKind = classifyCustomerAuthOrderAccess(row, args.now);
  return isEligibleCustomerAuthOrderAccessKind(accessKind) ? row : null;
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

export async function loadCustomerOrderForPanel(
  input: LoadCustomerOrderForPanelInput,
): Promise<LoadCustomerOrderForPanelResult> {
  const now = input.now ?? new Date();
  const row = await loadOwnedVisibleOrderRow({
    orderNumber: input.orderNumber,
    normalizedEmail: input.normalizedEmail,
    now,
  });

  if (!row) {
    return { kind: 'not_found' };
  }

  const invoiceData = parseOrderInvoiceData(row.invoice_data);
  const shouldCheckWithdrawalForm =
    invoiceData.storagePath !== null &&
    canReceiveB2cWithdrawalForm(invoiceData);
  const [items, returnCases, cancellationRequests, hasWithdrawalForm] =
    await Promise.all([
      loadOrderItems(row.id),
      loadReturnCases(row.id),
      loadCancellationRequests(row.id),
      shouldCheckWithdrawalForm
        ? hasB2cWithdrawalFormDocument().catch((error) => {
            console.error(
              '[B2C Documents] Failed to check withdrawal form availability.',
              error,
            );
            return false;
          })
        : Promise.resolve(false),
    ]);

  return {
    kind: 'found',
    order: mapCustomerOrderDetail({
      hasWithdrawalFormDocument: hasWithdrawalForm,
      row,
      items,
      returnCases,
      cancellationRequests,
      now,
    }),
  };
}

export async function createCustomerOrderInvoiceSignedUrl(
  input: LoadCustomerOrderForPanelInput,
): Promise<string | null> {
  const now = input.now ?? new Date();
  const row = await loadOwnedVisibleOrderRow({
    orderNumber: input.orderNumber,
    normalizedEmail: input.normalizedEmail,
    now,
  });

  if (!row) {
    return null;
  }

  const invoiceData = parseOrderInvoiceData(row.invoice_data);

  if (!invoiceData.storagePath) {
    return null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(INVOICE_STORAGE_BUCKET)
    .createSignedUrl(invoiceData.storagePath, INVOICE_SIGNED_URL_TTL_SECONDS);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function loadCustomerOrderWithdrawalFormDocument(
  input: LoadCustomerOrderForPanelInput,
) {
  const now = input.now ?? new Date();
  const row = await loadOwnedVisibleOrderRow({
    orderNumber: input.orderNumber,
    normalizedEmail: input.normalizedEmail,
    now,
  });

  if (!row) {
    return null;
  }

  const invoiceData = parseOrderInvoiceData(row.invoice_data);

  if (!invoiceData.storagePath || !canReceiveB2cWithdrawalForm(invoiceData)) {
    return null;
  }

  return loadB2cWithdrawalFormDocument();
}
