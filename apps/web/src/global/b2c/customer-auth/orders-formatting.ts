import {
  formatOrderExpectedDeliveryEstimate,
  type ParsedOrderExpectedDeliveryEstimate,
} from '../utils/orders';
import type { CustomerOrdersListItem } from './server/orders';

export type CustomerOrderStatusTone =
  | 'success'
  | 'warning'
  | 'processing'
  | 'shipped'
  | 'destructive'
  | 'returned'
  | 'neutral';

const ORDER_STATUS_LABELS: Record<string, string> = {
  awaiting_confirmation: 'Oczekiwanie na potwierdzenie',
  paid: 'Opłacone',
  processing: 'W realizacji',
  shipped: 'Wysłane',
  completed: 'Zrealizowane',
  cancelled: 'Anulowane',
  returned: 'Zwrócone',
  awaiting_payment: 'Oczekuje na płatność',
};

/**
 * Resolve a Polish label for an order list item. Uses `accessKind` so that
 * `awaiting_payment_active` is shown distinctly from raw DB status; falls
 * back to the raw status when no translation is mapped.
 */
export function getCustomerOrderStatusLabel(
  order: Pick<CustomerOrdersListItem, 'currentStatus' | 'accessKind'>,
): string {
  const statusKey =
    order.accessKind === 'awaiting_payment_active'
      ? 'awaiting_payment'
      : order.currentStatus;

  return ORDER_STATUS_LABELS[statusKey] ?? order.currentStatus;
}

/**
 * Tone classification used by the status pill. Active payments need a
 * "warning" treatment (deadline-bound action). Fulfillment statuses use
 * distinct tones so the order list can be scanned quickly.
 */
export function getCustomerOrderStatusTone(
  order: Pick<CustomerOrdersListItem, 'currentStatus' | 'accessKind'>,
): CustomerOrderStatusTone {
  if (order.accessKind === 'awaiting_payment_active') {
    return 'warning';
  }

  switch (order.currentStatus) {
    case 'awaiting_confirmation':
    case 'paid':
    case 'completed':
      return 'success';
    case 'processing':
      return 'processing';
    case 'shipped':
      return 'shipped';
    case 'cancelled':
      return 'destructive';
    case 'returned':
      return 'returned';
    default:
      return 'neutral';
  }
}

export function getCustomerPaymentStatusLabel(
  order: Pick<CustomerOrdersListItem, 'currentStatus' | 'accessKind'> & {
    paidAt?: string | null;
    paymentVerifiedAt?: string | null;
  },
): string {
  if (order.paidAt || order.paymentVerifiedAt) {
    return 'Opłacone';
  }

  if (
    order.accessKind === 'awaiting_payment_active' ||
    order.currentStatus === 'awaiting_payment'
  ) {
    return 'Oczekuje na płatność';
  }

  return 'Brak potwierdzenia płatności';
}

export function getCustomerTimelineStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

const ORDER_DATE_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const ORDER_DATETIME_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatCustomerOrderDate(iso: string): string {
  const timestamp = Date.parse(iso);

  if (Number.isNaN(timestamp)) {
    return iso;
  }

  return ORDER_DATE_FORMATTER.format(new Date(timestamp));
}

export function formatCustomerOrderDateTime(iso: string): string {
  const timestamp = Date.parse(iso);

  if (Number.isNaN(timestamp)) {
    return iso;
  }

  return ORDER_DATETIME_FORMATTER.format(new Date(timestamp));
}

export function formatCustomerDeliveryEstimate(
  estimate: ParsedOrderExpectedDeliveryEstimate | null,
): string | null {
  return formatOrderExpectedDeliveryEstimate(estimate);
}
