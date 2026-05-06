import {
  B2C_ORDER_STATUSES,
  type B2cOrderStatus,
} from '@/src/global/b2c/utils/statuses';

export const CUSTOMER_AUTH_VISIBLE_ORDER_STATUSES = B2C_ORDER_STATUSES.filter(
  (status): status is Exclude<B2cOrderStatus, 'awaiting_payment'> =>
    status !== 'awaiting_payment',
);

const CUSTOMER_AUTH_VISIBLE_ORDER_STATUS_SET = new Set<string>(
  CUSTOMER_AUTH_VISIBLE_ORDER_STATUSES,
);

export type CustomerAuthOrderAccessKind =
  | 'customer_visible'
  | 'awaiting_payment_active'
  | 'awaiting_payment_expired'
  | 'not_customer_visible';

export type CustomerAuthEligibilityReason =
  | 'eligible_order_access'
  | 'no_matching_orders'
  | 'only_expired_awaiting_payment_orders'
  | 'invalid_email';

export type CustomerAuthEligibilityMatchedOrder = {
  id: string;
  orderNumber: string;
  currentStatus: string;
  payableUntil: string;
  customerProfileId: string | null;
  createdAt: string;
  accessKind: CustomerAuthOrderAccessKind;
};

export type CustomerAuthEligibilityProfileSummary = {
  id: string;
  email: string;
  authUserId: string | null;
};

export type CustomerAuthEligibilityResult = {
  normalizedEmail: string | null;
  isValidEmail: boolean;
  isEligible: boolean;
  reason: CustomerAuthEligibilityReason;
  matchedOrders: CustomerAuthEligibilityMatchedOrder[];
  matchedProfile: CustomerAuthEligibilityProfileSummary | null;
};

type CustomerAuthOrderForAccessCheck = {
  current_status: string;
  payable_until: string;
};

export function isCustomerVisibleOrderStatus(status: string): boolean {
  return CUSTOMER_AUTH_VISIBLE_ORDER_STATUS_SET.has(status);
}

export function classifyCustomerAuthOrderAccess(
  order: CustomerAuthOrderForAccessCheck,
  now: Date = new Date(),
): CustomerAuthOrderAccessKind {
  if (isCustomerVisibleOrderStatus(order.current_status)) {
    return 'customer_visible';
  }

  if (order.current_status !== 'awaiting_payment') {
    return 'not_customer_visible';
  }

  const payableUntilTimestamp = Date.parse(order.payable_until);

  if (Number.isNaN(payableUntilTimestamp)) {
    return 'awaiting_payment_expired';
  }

  return payableUntilTimestamp > now.getTime()
    ? 'awaiting_payment_active'
    : 'awaiting_payment_expired';
}

export function isEligibleCustomerAuthOrderAccessKind(
  accessKind: CustomerAuthOrderAccessKind,
): boolean {
  return (
    accessKind === 'customer_visible' ||
    accessKind === 'awaiting_payment_active'
  );
}
