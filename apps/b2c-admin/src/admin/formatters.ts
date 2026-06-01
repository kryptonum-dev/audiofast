import type {
  AdminCoupon,
  AdminCouponDerivedStatus,
  AdminCouponDiscountType,
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
  awaiting_confirmation: "Oczekiwanie na potwierdzenie",
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
  awaiting_confirmation: "primary",
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

export const COUPON_STATUS_LABELS: Record<AdminCouponDerivedStatus, string> = {
  active: "Aktywny",
  expired: "Wygasły",
  inactive: "Nieaktywny",
  scheduled: "Zaplanowany",
  usage_limit_reached: "Limit osiągnięty",
};

export const COUPON_STATUS_TONES: Record<
  AdminCouponDerivedStatus,
  "default" | "primary" | "positive" | "caution" | "critical"
> = {
  active: "positive",
  expired: "critical",
  inactive: "default",
  scheduled: "primary",
  usage_limit_reached: "caution",
};

export const COUPON_DISCOUNT_TYPE_LABELS: Record<
  AdminCouponDiscountType,
  string
> = {
  fixed_order: "Kwota na koszyk",
  fixed_product: "Kwota na produkty",
  percent_order: "% na koszyk",
  percent_product: "% na produkty",
};

export function formatOrderStatus(status: string): string {
  return ORDER_STATUS_LABELS[status as AdminOrderStatus] ?? status;
}

export function formatReturnCaseStatus(status: string): string {
  switch (status) {
    case "open":
      return "Oczekiwanie na potwierdzenie";
    case "awaiting_goods":
      return "Oczekiwanie na zwrot towaru";
    case "completed":
      return "Towar zwrócony";
    case "closed_without_return":
      return "Zamknięte bez zwrotu";
    default:
      return status;
  }
}

export function formatPaymentStatus(args: {
  currentStatus: string;
  paidAt: string | null;
  verifiedAt?: string | null;
}): string {
  if (args.paidAt || args.verifiedAt) {
    return "Opłacone";
  }

  if (args.currentStatus === "awaiting_payment") {
    return "Oczekuje na płatność";
  }

  return "Brak potwierdzenia płatności";
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

export function formatOptionalDate(value: string | null): string {
  if (!value) {
    return "";
  }

  const formatted = formatDateTime(value);

  return formatted.split(",")[0] ?? formatted;
}

export function formatDeliveryEstimate(
  estimate: { from: string; to: string | null } | null,
): string {
  if (!estimate) {
    return "Brak terminu";
  }

  const from = formatOptionalDate(estimate.from);
  const to = formatOptionalDate(estimate.to);

  if (!to || to === from) {
    return from || "Brak terminu";
  }

  return `${from} - ${to}`;
}

export function formatMoney(cents: number): string {
  return CURRENCY_FORMATTER.format(cents / 100);
}

export function formatCouponStatus(status: string): string {
  return COUPON_STATUS_LABELS[status as AdminCouponDerivedStatus] ?? status;
}

export function formatCouponDiscount(coupon: AdminCoupon): string {
  if (coupon.discountType.startsWith("fixed")) {
    return coupon.discountValueCents === null
      ? "Nie ustawiono"
      : formatMoney(coupon.discountValueCents);
  }

  return coupon.discountPercent === null
    ? "Nie ustawiono"
    : `${coupon.discountPercent}%`;
}

export function formatCouponScope(coupon: AdminCoupon): string {
  if (coupon.discountType.endsWith("_product")) {
    return "Wybrane produkty";
  }

  return "Cały koszyk";
}

export function formatCouponActivityWindow(coupon: AdminCoupon): string {
  const from = formatOptionalDate(coupon.startsAt);
  const to = formatOptionalDate(coupon.expiresAt);

  if (from && to) {
    return `${from} - ${to}`;
  }

  if (from) {
    return `Od ${from}`;
  }

  if (to) {
    return `Do ${to}`;
  }

  return "Bez terminu";
}
