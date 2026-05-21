import type { Json } from '@/src/global/supabase/database.types';

export type OrderAddressBlock = {
  companyName: string | null;
  recipientName: string | null;
  phone: string | null;
  taxId: string | null;
  lines: string[];
};

export type ParsedOrderInvoiceData = {
  recipientType: 'private' | 'company' | 'unknown';
  companyName: string | null;
  taxId: string | null;
  invoiceAddress: OrderAddressBlock | null;
  storagePath: string | null;
  filename: string | null;
  attachedAt: string | null;
};

export type ParsedOrderShipmentData = {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
};

export type ParsedOrderExpectedDeliveryEstimate = {
  from: string;
  to: string | null;
};

export type ParsedOrderDiscountData = {
  couponCode: string | null;
  discountType: string | null;
  discountValueCents: number | null;
  discountPercent: number | null;
  totalDiscountCents: number;
};

export type ParsedOrderItemSnapshot = {
  details: string[];
  cpoContext: {
    availabilityStatusAtPurchase: string | null;
    archivedAtPurchase: boolean | null;
  } | null;
};

export type ParsedOrderTimelineEntry = {
  id: string;
  status: string;
  changedAt: string;
  source: string | null;
  previousStatus: string | null;
  actor: string | null;
  actorEmail: string | null;
  actorImage: string | null;
  actorName: string | null;
  note: string | null;
};

export type OrderStatusTimelineSource = {
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  current_status: string;
  paid_at: string | null;
  returned_at: string | null;
  shipped_at: string | null;
  status_history: Json;
  updated_at: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function getBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function formatPersonName(
  firstName: string | null,
  lastName: string | null,
) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName.length > 0 ? fullName : null;
}

export function formatOrderAddressLine(
  record: Record<string, unknown>,
): string | null {
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

export function formatOrderCityLine(
  record: Record<string, unknown>,
): string | null {
  const postalCode = getString(record.postalCode);
  const city = getString(record.city);
  return [postalCode, city].filter(Boolean).join(' ') || null;
}

export function parseOrderAddressBlock(
  value: Json | null,
  options: { includeRecipient: boolean },
): OrderAddressBlock | null {
  if (!isRecord(value)) {
    return null;
  }

  const recipientName = options.includeRecipient
    ? formatPersonName(getString(value.firstName), getString(value.lastName))
    : null;
  const addressLine = formatOrderAddressLine(value);
  const cityLine = formatOrderCityLine(value);
  const country = getString(value.country);

  return {
    companyName: getString(value.companyName),
    recipientName,
    phone: getString(value.phone),
    taxId: getString(value.taxId),
    lines: [addressLine, cityLine, country].filter(Boolean) as string[],
  };
}

export function parseOrderShippingAddressSnapshot(
  value: Json,
): OrderAddressBlock {
  return (
    parseOrderAddressBlock(value, { includeRecipient: true }) ?? {
      companyName: null,
      recipientName: null,
      phone: null,
      taxId: null,
      lines: [],
    }
  );
}

export function parseOrderInvoiceData(
  value: Json | null,
): ParsedOrderInvoiceData {
  if (!isRecord(value)) {
    return {
      recipientType: 'private',
      companyName: null,
      taxId: null,
      invoiceAddress: null,
      storagePath: null,
      filename: null,
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
    invoiceAddress: parseOrderAddressBlock(
      (value.invoiceAddress ?? null) as Json | null,
      { includeRecipient: false },
    ),
    storagePath: getString(value.storagePath),
    filename: getString(value.filename),
    attachedAt: getString(value.attachedAt),
  };
}

export function getOrderInvoiceRecipientType(
  value: Json | null,
): ParsedOrderInvoiceData['recipientType'] {
  return parseOrderInvoiceData(value).recipientType;
}

export function parseOrderShipmentData(
  value: Json | null,
  shippedAt: string | null,
): ParsedOrderShipmentData | null {
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

const ORDER_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ORDER_DATE_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});
const ORDER_DAY_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  timeZone: 'UTC',
});
const ORDER_DAY_MONTH_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

export function isOrderDateOnlyString(value: string): boolean {
  if (!ORDER_DATE_ONLY_RE.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function compareOrderDateOnlyStrings(
  left: string,
  right: string,
): number {
  return left.localeCompare(right);
}

export function parseOrderExpectedDeliveryEstimate(
  from: unknown,
  to: unknown,
): ParsedOrderExpectedDeliveryEstimate | null {
  const fromDate = getString(from);

  if (!fromDate || !isOrderDateOnlyString(fromDate)) {
    return null;
  }

  const toDate = getString(to);
  const normalizedTo =
    toDate &&
    isOrderDateOnlyString(toDate) &&
    compareOrderDateOnlyStrings(toDate, fromDate) >= 0
      ? toDate
      : null;

  return {
    from: fromDate,
    to: normalizedTo,
  };
}

function getUtcDateParts(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  return {
    date,
    month: date.getUTCMonth(),
    year: date.getUTCFullYear(),
  };
}

export function formatOrderExpectedDeliveryEstimate(
  estimate: ParsedOrderExpectedDeliveryEstimate | null,
): string | null {
  if (!estimate) {
    return null;
  }

  const fromParts = getUtcDateParts(estimate.from);
  const toParts = estimate.to ? getUtcDateParts(estimate.to) : null;

  if (!toParts || estimate.to === estimate.from) {
    return ORDER_DATE_FORMATTER.format(fromParts.date);
  }

  if (fromParts.year === toParts.year && fromParts.month === toParts.month) {
    return `${ORDER_DAY_FORMATTER.format(fromParts.date)}-${ORDER_DATE_FORMATTER.format(toParts.date)}`;
  }

  if (fromParts.year === toParts.year) {
    return `${ORDER_DAY_MONTH_FORMATTER.format(fromParts.date)} - ${ORDER_DATE_FORMATTER.format(toParts.date)}`;
  }

  return `${ORDER_DATE_FORMATTER.format(fromParts.date)} - ${ORDER_DATE_FORMATTER.format(toParts.date)}`;
}

export function parseOrderDiscountData(
  value: Json | null,
): ParsedOrderDiscountData | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    couponCode: getString(value.couponCode),
    discountType: getString(value.discountType),
    discountValueCents: getNumber(value.discountValueCents),
    discountPercent: getNumber(value.discountPercent),
    totalDiscountCents: getNumber(value.totalDiscountCents) ?? 0,
  };
}

export function formatOrderSelectedOption(option: unknown): string | null {
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

export function parseOrderItemSnapshot(
  value: Json,
  lineType: string,
): ParsedOrderItemSnapshot {
  const details: string[] = [];
  let cpoContext: ParsedOrderItemSnapshot['cpoContext'] = null;

  if (isRecord(value)) {
    const model = getString(value.model);

    if (model) {
      details.push(`Model: ${model}`);
    }

    if (Array.isArray(value.selectedOptions)) {
      for (const option of value.selectedOptions) {
        const label = formatOrderSelectedOption(option);

        if (label) {
          details.push(label);
        }
      }
    }

    if (lineType === 'cpo') {
      cpoContext = {
        availabilityStatusAtPurchase: getString(
          value.availabilityStatusAtPurchase,
        ),
        archivedAtPurchase: getBoolean(value.archivedAtPurchase),
      };
    }
  }

  return {
    details,
    cpoContext,
  };
}

export function parseOrderTimelineEntry(
  entry: unknown,
  index: number,
): ParsedOrderTimelineEntry | null {
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
    source: getString(entry.source),
    previousStatus: getString(entry.previousStatus),
    actor:
      getString(entry.actor) ??
      getString(entry.actorName) ??
      getString(entry.actorEmail),
    actorEmail: getString(entry.actorEmail),
    actorImage:
      getString(entry.actorImage) ??
      getString(entry.actorProfileImage) ??
      getString(entry.profileImage),
    actorName: getString(entry.actorName),
    note: getString(entry.note),
  };
}

export function appendOrderTimelineTimestampEntry(
  entries: ParsedOrderTimelineEntry[],
  status: string,
  changedAt: string | null,
  source: string | null,
) {
  if (!changedAt || entries.some((entry) => entry.status === status)) {
    return;
  }

  entries.push({
    id: `${status}-${changedAt}-fallback`,
    status,
    changedAt,
    source,
    previousStatus: null,
    actor: null,
    actorEmail: null,
    actorImage: null,
    actorName: null,
    note: null,
  });
}

function shouldIncludeTimestampStatus(currentStatus: string, status: string) {
  const statusOrder = [
    'awaiting_payment',
    'paid',
    'awaiting_confirmation',
    'processing',
    'shipped',
    'completed',
    'cancelled',
    'returned',
  ];
  const currentIndex = statusOrder.indexOf(currentStatus);
  const statusIndex = statusOrder.indexOf(status);

  if (currentIndex === -1 || statusIndex === -1) {
    return true;
  }

  return statusIndex <= currentIndex;
}

export function buildOrderStatusTimeline(
  row: OrderStatusTimelineSource,
  options: {
    fallbackSource?: (status: string) => string | null;
  } = {},
): ParsedOrderTimelineEntry[] {
  const entries = Array.isArray(row.status_history)
    ? row.status_history.flatMap((entry, index) => {
        const parsed = parseOrderTimelineEntry(entry, index);
        return parsed ? [parsed] : [];
      })
    : [];
  const fallbackSource = options.fallbackSource ?? (() => null);

  appendOrderTimelineTimestampEntry(
    entries,
    'awaiting_payment',
    row.created_at,
    fallbackSource('awaiting_payment'),
  );
  appendOrderTimelineTimestampEntry(
    entries,
    'paid',
    row.paid_at,
    fallbackSource('paid'),
  );
  if (shouldIncludeTimestampStatus(row.current_status, 'shipped')) {
    appendOrderTimelineTimestampEntry(
      entries,
      'shipped',
      row.shipped_at,
      fallbackSource('shipped'),
    );
  }
  if (shouldIncludeTimestampStatus(row.current_status, 'completed')) {
    appendOrderTimelineTimestampEntry(
      entries,
      'completed',
      row.completed_at,
      fallbackSource('completed'),
    );
  }
  appendOrderTimelineTimestampEntry(
    entries,
    'cancelled',
    row.cancelled_at,
    fallbackSource('cancelled'),
  );
  appendOrderTimelineTimestampEntry(
    entries,
    'returned',
    row.returned_at,
    fallbackSource('returned'),
  );
  appendOrderTimelineTimestampEntry(
    entries,
    row.current_status,
    row.updated_at ?? row.created_at,
    fallbackSource(row.current_status),
  );

  return entries.sort(
    (left, right) => Date.parse(left.changedAt) - Date.parse(right.changedAt),
  );
}
