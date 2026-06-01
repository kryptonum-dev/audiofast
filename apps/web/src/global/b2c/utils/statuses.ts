export const B2C_ORDER_STATUSES = [
  'awaiting_payment',
  'awaiting_confirmation',
  'paid',
  'processing',
  'shipped',
  'completed',
  'cancelled',
  'returned',
] as const;

export type B2cOrderStatus = (typeof B2C_ORDER_STATUSES)[number];

export const B2C_RETURN_WINDOW_DAYS = 14;

const B2C_ORDER_STATUS_SET = new Set<string>(B2C_ORDER_STATUSES);
const ADMIN_ORDER_TRANSITIONS: Record<B2cOrderStatus, B2cOrderStatus[]> = {
  awaiting_payment: [],
  awaiting_confirmation: ['processing', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'completed', 'cancelled'],
  shipped: ['completed', 'returned'],
  completed: ['returned'],
  cancelled: [],
  returned: [],
};

export function isB2cOrderStatus(value: unknown): value is B2cOrderStatus {
  return typeof value === 'string' && B2C_ORDER_STATUS_SET.has(value);
}

export function getAdminAllowedNextOrderStatuses(
  status: string,
): B2cOrderStatus[] {
  return isB2cOrderStatus(status) ? ADMIN_ORDER_TRANSITIONS[status] : [];
}

export function getAdminAllowedNextOrderStatusesForOrder(args: {
  currentStatus: string;
  now: Date;
  shippedAt: string | null;
}): B2cOrderStatus[] {
  return getAdminAllowedNextOrderStatuses(args.currentStatus).filter(
    (status) =>
      status !== 'returned' ||
      isWithinReturnWindow({
        now: args.now,
        shippedAt: args.shippedAt,
      }),
  );
}

export function isCancellableOrderStatus(status: string): boolean {
  return (
    status === 'awaiting_confirmation' ||
    status === 'paid' ||
    status === 'processing'
  );
}

export function isReturnEligibleOrderStatus(status: string): boolean {
  return status === 'shipped' || status === 'completed';
}

export function getReturnDeadline(shippedAt: string | null): number {
  const shippedTimestamp = shippedAt ? Date.parse(shippedAt) : Number.NaN;

  return Number.isNaN(shippedTimestamp)
    ? Number.NaN
    : shippedTimestamp + B2C_RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function isWithinReturnWindow(args: {
  now: Date;
  shippedAt: string | null;
}): boolean {
  const returnDeadline = getReturnDeadline(args.shippedAt);

  return !Number.isNaN(returnDeadline) && args.now.getTime() <= returnDeadline;
}
