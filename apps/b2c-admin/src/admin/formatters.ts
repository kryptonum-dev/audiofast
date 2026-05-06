import type {
  AdminOrderLineType,
  AdminOrderStatus,
} from "./types.js";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const CURRENCY_FORMATTER = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

export const ORDER_STATUS_LABELS: Record<AdminOrderStatus, string> = {
  awaiting_payment: "Oczekuje na płatność",
  paid: "Opłacone",
  processing: "W realizacji",
  shipped: "Wysłane",
  completed: "Zakończone",
  cancelled: "Anulowane",
  returned: "Zwrócone",
};

export const ORDER_STATUS_TONES: Record<
  AdminOrderStatus,
  "default" | "primary" | "positive" | "caution" | "critical"
> = {
  awaiting_payment: "caution",
  paid: "primary",
  processing: "default",
  shipped: "positive",
  completed: "positive",
  cancelled: "critical",
  returned: "caution",
};

export const ORDER_LINE_TYPE_LABELS: Record<AdminOrderLineType, string> = {
  standard: "Katalogowe",
  cpo: "CPO",
  mixed: "Mieszane",
};

export function formatOrderStatus(status: string): string {
  return ORDER_STATUS_LABELS[status as AdminOrderStatus] ?? status;
}

export function formatLineType(lineTypes: string[]): string {
  const normalized = lineTypes.filter(Boolean);

  if (normalized.includes("standard") && normalized.includes("cpo")) {
    return ORDER_LINE_TYPE_LABELS.mixed;
  }

  if (normalized[0] === "cpo") {
    return ORDER_LINE_TYPE_LABELS.cpo;
  }

  return ORDER_LINE_TYPE_LABELS.standard;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return DATE_TIME_FORMATTER.format(date);
}

export function formatMoney(cents: number): string {
  return CURRENCY_FORMATTER.format(cents / 100);
}
