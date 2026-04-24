import 'server-only';

import { createAdminClient } from '@/src/global/supabase/admin';

import {
  classifyCustomerAuthOrderAccess,
  type CustomerAuthEligibilityResult,
  isEligibleCustomerAuthOrderAccessKind,
} from '../eligibility';
import { isValidCustomerAuthEmail, normalizeCustomerAuthEmail } from '../email';
import type {
  CustomerAuthEligibilityOrderRow,
  CustomerAuthEligibilityProfileRow,
} from './types';

const CUSTOMER_AUTH_ELIGIBILITY_ORDER_SELECT =
  'id, order_number, current_status, payable_until, customer_profile_id, created_at';

const CUSTOMER_AUTH_ELIGIBILITY_PROFILE_SELECT = 'id, email, auth_user_id';

export class CustomerAuthEligibilityError extends Error {
  readonly code = 'database_error';

  constructor(
    message: string,
    readonly causeError?: unknown,
  ) {
    super(message);
    this.name = 'CustomerAuthEligibilityError';
  }
}

async function loadOrdersForCustomerAuthEligibility(
  normalizedEmail: string,
): Promise<CustomerAuthEligibilityOrderRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(CUSTOMER_AUTH_ELIGIBILITY_ORDER_SELECT)
    .ilike('customer_email', normalizedEmail)
    .order('created_at', { ascending: false });

  if (error) {
    throw new CustomerAuthEligibilityError(
      'Failed to load customer auth eligibility orders.',
      error,
    );
  }

  return (data ?? []) as CustomerAuthEligibilityOrderRow[];
}

async function loadMatchingCustomerProfile(
  normalizedEmail: string,
): Promise<CustomerAuthEligibilityProfileRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_profiles')
    .select(CUSTOMER_AUTH_ELIGIBILITY_PROFILE_SELECT)
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new CustomerAuthEligibilityError(
      'Failed to load matching customer profile for auth eligibility.',
      error,
    );
  }

  return (data ?? null) as CustomerAuthEligibilityProfileRow | null;
}

export async function resolveCustomerAuthEligibility(args: {
  email: string;
  now?: Date;
}): Promise<CustomerAuthEligibilityResult> {
  const normalizedEmail = normalizeCustomerAuthEmail(args.email);

  if (!isValidCustomerAuthEmail(normalizedEmail)) {
    return {
      normalizedEmail,
      isValidEmail: false,
      isEligible: false,
      reason: 'invalid_email',
      matchedOrders: [],
      matchedProfile: null,
    };
  }

  const [orders, matchedProfile] = await Promise.all([
    loadOrdersForCustomerAuthEligibility(normalizedEmail),
    loadMatchingCustomerProfile(normalizedEmail),
  ]);

  const matchedOrders = orders.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    currentStatus: order.current_status,
    payableUntil: order.payable_until,
    customerProfileId: order.customer_profile_id,
    createdAt: order.created_at,
    accessKind: classifyCustomerAuthOrderAccess(order, args.now),
  }));

  const eligibleOrders = matchedOrders.filter((order) =>
    isEligibleCustomerAuthOrderAccessKind(order.accessKind),
  );

  if (eligibleOrders.length > 0) {
    return {
      normalizedEmail,
      isValidEmail: true,
      isEligible: true,
      reason: 'eligible_order_access',
      matchedOrders,
      matchedProfile: matchedProfile
        ? {
            id: matchedProfile.id,
            email: matchedProfile.email,
            authUserId: matchedProfile.auth_user_id,
          }
        : null,
    };
  }

  const hasExpiredAwaitingPaymentOrders = matchedOrders.some(
    (order) => order.accessKind === 'awaiting_payment_expired',
  );

  return {
    normalizedEmail,
    isValidEmail: true,
    isEligible: false,
    reason: hasExpiredAwaitingPaymentOrders
      ? 'only_expired_awaiting_payment_orders'
      : 'no_matching_orders',
    matchedOrders,
    matchedProfile: matchedProfile
      ? {
          id: matchedProfile.id,
          email: matchedProfile.email,
          authUserId: matchedProfile.auth_user_id,
        }
      : null,
  };
}
