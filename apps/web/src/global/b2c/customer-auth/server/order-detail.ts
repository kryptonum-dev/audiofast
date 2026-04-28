import 'server-only';

import type { SanityRawImage } from '@/src/components/shared/Image';
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

export type CustomerOrderAddressBlock = {
  recipientName: string | null;
  phone: string | null;
  lines: string[];
};

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
  completedAt: string | null;
};

export type CustomerOrderCancellationRequestSummary = {
  status: string;
  reason: string | null;
  customerMessage: string | null;
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
  shipment: CustomerOrderShipmentSnapshot | null;
  items: CustomerOrderDetailItem[];
  timeline: CustomerOrderTimelineEntry[];
  activeReturnCase: CustomerOrderReturnCaseSummary | null;
  cancellationRequest: CustomerOrderCancellationRequestSummary | null;
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

type ParsedInvoiceData = {
  recipientType: 'private' | 'company' | 'unknown';
  companyName: string | null;
  taxId: string | null;
  invoiceAddress: CustomerOrderAddressBlock | null;
  storagePath: string | null;
  attachedAt: string | null;
};

const CUSTOMER_ORDER_DETAIL_SELECT =
  'cancelled_at, completed_at, created_at, current_status, customer_email, customer_snapshot, discount_total_cents, grand_total_cents, id, invoice_data, order_number, paid_at, payable_until, payment_reference, payment_verified_at, returned_at, shipment_data, shipped_at, shipping_address_snapshot, status_history, subtotal_cents, used_discount, updated_at';

const INVOICE_SIGNED_URL_TTL_SECONDS = 60;
const INVOICE_STORAGE_BUCKET =
  process.env.SUPABASE_ORDER_INVOICES_BUCKET ?? 'order-invoices';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function formatPersonName(firstName: string | null, lastName: string | null) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName.length > 0 ? fullName : null;
}

function formatAddressLine(record: Record<string, unknown>): string | null {
  const streetName = getString(record.streetName) ?? getString(record.street);
  const buildingNumber = getString(record.buildingNumber);
  const apartmentNumber = getString(record.apartmentNumber);

  if (!streetName) {
    return null;
  }

  const numberPart = [buildingNumber, apartmentNumber]
    .filter(Boolean)
    .join('/');

  return [streetName, numberPart].filter(Boolean).join(' ');
}

function formatCityLine(record: Record<string, unknown>): string | null {
  const postalCode = getString(record.postalCode);
  const city = getString(record.city);
  return [postalCode, city].filter(Boolean).join(' ') || null;
}

function parseAddressBlock(
  value: Json | null,
  options: { includeRecipient: boolean },
): CustomerOrderAddressBlock | null {
  if (!isRecord(value)) {
    return null;
  }

  const recipientName = options.includeRecipient
    ? formatPersonName(getString(value.firstName), getString(value.lastName))
    : null;
  const addressLine = formatAddressLine(value);
  const cityLine = formatCityLine(value);
  const country = getString(value.country);

  return {
    recipientName,
    phone: getString(value.phone),
    lines: [addressLine, cityLine, country].filter(Boolean) as string[],
  };
}

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

function parseShippingAddressSnapshot(value: Json): CustomerOrderAddressBlock {
  return (
    parseAddressBlock(value, { includeRecipient: true }) ?? {
      recipientName: null,
      phone: null,
      lines: [],
    }
  );
}

function parseInvoiceData(value: Json | null): ParsedInvoiceData {
  if (!isRecord(value)) {
    return {
      recipientType: 'private',
      companyName: null,
      taxId: null,
      invoiceAddress: null,
      storagePath: null,
      attachedAt: null,
    };
  }

  const rawRecipientType = getString(value.recipientType);
  const recipientType =
    rawRecipientType === 'private' || rawRecipientType === 'company'
      ? rawRecipientType
      : 'unknown';

  return {
    recipientType,
    companyName: getString(value.companyName),
    taxId: getString(value.taxId),
    invoiceAddress: parseAddressBlock(
      (value.invoiceAddress ?? null) as Json | null,
      { includeRecipient: false },
    ),
    storagePath: getString(value.storagePath),
    attachedAt: getString(value.attachedAt),
  };
}

function mapInvoiceData(
  orderNumber: string,
  invoiceData: ParsedInvoiceData,
): CustomerOrderInvoiceSnapshot {
  const hasDocument = invoiceData.storagePath !== null;

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
  };
}

function parseDiscountData(
  value: Json | null,
): CustomerOrderDiscountSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const totalDiscountCents = getNumber(value.totalDiscountCents) ?? 0;
  const discountValueCents = getNumber(value.discountValueCents);
  const discountPercent = getNumber(value.discountPercent);
  const discountValueLabel =
    discountValueCents !== null
      ? `${Math.round(discountValueCents / 100)} PLN`
      : discountPercent !== null
        ? `${discountPercent}%`
        : null;

  return {
    couponCode: getString(value.couponCode),
    discountType: getString(value.discountType),
    discountValueLabel,
    totalDiscountCents,
  };
}

function parseShipmentData(
  value: Json | null,
  shippedAt: string | null,
): CustomerOrderShipmentSnapshot | null {
  if (!isRecord(value) && !shippedAt) {
    return null;
  }

  const record = isRecord(value) ? value : {};
  return {
    carrier: getString(record.carrier),
    trackingNumber: getString(record.trackingNumber),
    trackingUrl: getString(record.trackingUrl),
    shippedAt: getString(record.shippedAt) ?? shippedAt,
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

function formatSelectedOption(option: unknown): string | null {
  if (!isRecord(option)) {
    return null;
  }

  const groupName = getString(option.groupName);
  const valueName = getString(option.valueName);
  const numericValue = getNumber(option.numericValue);
  const unit = getString(option.unit);
  const parentGroupName = getString(option.parentGroupName);
  const parentValueName = getString(option.parentValueName);
  const resolvedValue =
    valueName ??
    (numericValue !== null ? `${numericValue}${unit ?? ''}` : null);

  if (!groupName || !resolvedValue) {
    return null;
  }

  const prefix =
    parentGroupName && parentValueName
      ? `${parentGroupName}: ${parentValueName} / `
      : '';

  return `${prefix}${groupName}: ${resolvedValue}`;
}

function mapOrderItem(row: OrderItemRow): CustomerOrderDetailItem {
  const details: string[] = [];
  let cpoContext: string | null = null;

  if (isRecord(row.item_snapshot)) {
    const model = getString(row.item_snapshot.model);
    if (model) {
      details.push(`Model: ${model}`);
    }

    const selectedOptions = row.item_snapshot.selectedOptions;
    if (Array.isArray(selectedOptions)) {
      for (const option of selectedOptions) {
        const label = formatSelectedOption(option);
        if (label) {
          details.push(label);
        }
      }
    }

    const availabilityStatus = getString(
      row.item_snapshot.availabilityStatusAtPurchase,
    );
    const archivedAtPurchase = getBoolean(row.item_snapshot.archivedAtPurchase);
    const cpoDetails = [
      availabilityStatus ? `Status CPO: ${availabilityStatus}` : null,
      archivedAtPurchase !== null
        ? archivedAtPurchase
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
    details,
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

function parseTimelineEntry(
  entry: unknown,
  index: number,
): CustomerOrderTimelineEntry | null {
  if (!isRecord(entry)) {
    return null;
  }

  const status =
    getString(entry.status) ??
    getString(entry.newStatus) ??
    getString(entry.currentStatus);
  const changedAt =
    getString(entry.changedAt) ??
    getString(entry.changed_at) ??
    getString(entry.createdAt) ??
    getString(entry.at);

  if (!status || !changedAt) {
    return null;
  }

  return {
    id: `${status}-${changedAt}-${index}`,
    status,
    changedAt,
    sourceLabel: resolveTimelineSourceLabel(entry.source),
  };
}

function appendTimestampEntry(
  entries: CustomerOrderTimelineEntry[],
  status: string,
  changedAt: string | null,
  sourceLabel = 'Audiofast',
) {
  if (!changedAt || entries.some((entry) => entry.status === status)) {
    return;
  }

  entries.push({
    id: `${status}-${changedAt}-fallback`,
    status,
    changedAt,
    sourceLabel,
  });
}

function buildStatusTimeline(
  row: CustomerOrderDetailRow,
): CustomerOrderTimelineEntry[] {
  const parsedEntries = Array.isArray(row.status_history)
    ? row.status_history.flatMap((entry, index) => {
        const parsed = parseTimelineEntry(entry, index);
        return parsed ? [parsed] : [];
      })
    : [];

  appendTimestampEntry(
    parsedEntries,
    'awaiting_payment',
    row.created_at,
    'System Audiofast',
  );
  appendTimestampEntry(parsedEntries, 'paid', row.paid_at, 'System Audiofast');
  appendTimestampEntry(parsedEntries, 'shipped', row.shipped_at);
  appendTimestampEntry(parsedEntries, 'completed', row.completed_at);
  appendTimestampEntry(parsedEntries, 'cancelled', row.cancelled_at);
  appendTimestampEntry(parsedEntries, 'returned', row.returned_at);
  appendTimestampEntry(
    parsedEntries,
    row.current_status,
    row.updated_at ?? row.created_at,
  );

  return parsedEntries.sort(
    (left, right) => Date.parse(left.changedAt) - Date.parse(right.changedAt),
  );
}

function mapActiveReturnCase(
  row: ReturnCaseRow | null,
): CustomerOrderReturnCaseSummary | null {
  if (!row || (row.status !== 'open' && row.status !== 'completed')) {
    return null;
  }

  return {
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function mapCancellationRequest(
  row: CancellationRequestRow | null,
): CustomerOrderCancellationRequestSummary | null {
  if (!row) {
    return null;
  }

  return {
    status: row.status,
    reason: row.reason,
    customerMessage: row.customer_message,
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
    (args.row.current_status === 'paid' ||
      args.row.current_status === 'processing') &&
    args.cancellationRequest === null;
  const allItemsReturnable =
    args.items.length > 0 && args.items.every((item) => item.isReturnable);
  const returnStatusEligible =
    args.row.current_status === 'shipped' ||
    args.row.current_status === 'completed';
  const shippedTimestamp = args.row.shipped_at
    ? Date.parse(args.row.shipped_at)
    : Number.NaN;
  const returnDeadline = Number.isNaN(shippedTimestamp)
    ? Number.NaN
    : shippedTimestamp + 14 * 24 * 60 * 60 * 1000;
  const isWithinReturnWindow =
    !Number.isNaN(returnDeadline) && args.now.getTime() <= returnDeadline;
  const isCompanyInvoice = args.invoice.recipientType === 'company';
  const canRequestReturn =
    returnStatusEligible &&
    allItemsReturnable &&
    isWithinReturnWindow &&
    !isCompanyInvoice &&
    args.activeReturnCase === null;

  let returnMessage =
    'Zwrot będzie możliwy po wysyłce, jeżeli zamówienie spełnia warunki zwrotu.';

  if (args.activeReturnCase) {
    returnMessage =
      'Zgłoszenie zwrotu zostało wysłane. Audiofast poprowadzi dalszą obsługę poza głównym statusem zamówienia.';
  } else if (!returnStatusEligible) {
    returnMessage =
      'Zwrot można rozpocząć po wysyłce lub zakończeniu realizacji zamówienia.';
  } else if (!allItemsReturnable) {
    returnMessage =
      'To zamówienie zawiera produkt bez prawa zwrotu, dlatego samoobsługowy zwrot jest niedostępny.';
  } else if (isCompanyInvoice) {
    returnMessage =
      'Zakup z danymi firmowymi może wyłączać samoobsługowy zwrot w panelu.';
  } else if (!isWithinReturnWindow) {
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
  } else if (args.cancellationRequest?.status === 'rejected') {
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
  row: CustomerOrderDetailRow;
  items: OrderItemRow[];
  activeReturnCase: ReturnCaseRow | null;
  cancellationRequest: CancellationRequestRow | null;
  now: Date;
}): CustomerOrderDetail {
  const accessKind = classifyCustomerAuthOrderAccess(args.row, args.now);
  const invoiceData = parseInvoiceData(args.row.invoice_data);
  const items = args.items
    .map(mapOrderItem)
    .sort((left, right) => left.linePosition - right.linePosition);
  const activeReturnCase = mapActiveReturnCase(args.activeReturnCase);
  const cancellationRequest = mapCancellationRequest(args.cancellationRequest);

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
    shippingAddress: parseShippingAddressSnapshot(
      args.row.shipping_address_snapshot,
    ),
    invoice: mapInvoiceData(args.row.order_number, invoiceData),
    discount: parseDiscountData(args.row.used_discount),
    shipment: parseShipmentData(args.row.shipment_data, args.row.shipped_at),
    items,
    timeline: buildStatusTimeline(args.row),
    activeReturnCase,
    cancellationRequest,
    actions: buildActionEligibility({
      row: args.row,
      items,
      invoice: invoiceData,
      activeReturnCase,
      cancellationRequest,
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

async function loadActiveReturnCase(
  orderId: string,
): Promise<ReturnCaseRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('return_cases')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as ReturnCaseRow | null;
}

async function loadLatestCancellationRequest(
  orderId: string,
): Promise<CancellationRequestRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_cancellation_requests')
    .select('*')
    .eq('order_id', orderId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as CancellationRequestRow | null;
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

  const [items, activeReturnCase, cancellationRequest] = await Promise.all([
    loadOrderItems(row.id),
    loadActiveReturnCase(row.id),
    loadLatestCancellationRequest(row.id),
  ]);

  return {
    kind: 'found',
    order: mapCustomerOrderDetail({
      row,
      items,
      activeReturnCase,
      cancellationRequest,
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

  const invoiceData = parseInvoiceData(row.invoice_data);

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
