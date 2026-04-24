import 'server-only';

import { createAdminClient } from '@/src/global/supabase/admin';

import {
  classifyCustomerAuthOrderAccess,
  type CustomerAuthOrderAccessKind,
  isEligibleCustomerAuthOrderAccessKind,
} from '../eligibility';

type CustomerOrdersListRow = {
  id: string;
  order_number: string;
  current_status: string;
  payable_until: string;
  created_at: string;
  grand_total_cents: number;
};

export type CustomerOrdersListItem = {
  id: string;
  orderNumber: string;
  currentStatus: string;
  payableUntil: string;
  createdAt: string;
  grandTotalCents: number;
  accessKind: CustomerAuthOrderAccessKind;
};

export async function loadCustomerOrdersForPanel(
  normalizedEmail: string,
  now: Date = new Date(),
): Promise<CustomerOrdersListItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, current_status, payable_until, created_at, grand_total_cents',
    )
    .ilike('customer_email', normalizedEmail)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as CustomerOrdersListRow[])
    .map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      currentStatus: order.current_status,
      payableUntil: order.payable_until,
      createdAt: order.created_at,
      grandTotalCents: order.grand_total_cents,
      accessKind: classifyCustomerAuthOrderAccess(order, now),
    }))
    .filter((order) => isEligibleCustomerAuthOrderAccessKind(order.accessKind));
}
