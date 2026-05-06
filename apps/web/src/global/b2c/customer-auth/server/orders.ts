import 'server-only';

import type { SanityRawImage } from '@/src/components/shared/Image';
import {
  CUSTOMER_ORDERS_ITEMS_PER_PAGE,
  type CustomerOrdersSortBy,
} from '@/src/global/b2c/customer-auth/orders-listing-query';
import { isRecord } from '@/src/global/b2c/utils/orders';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

import {
  classifyCustomerAuthOrderAccess,
  CUSTOMER_AUTH_VISIBLE_ORDER_STATUSES,
  type CustomerAuthOrderAccessKind,
  isEligibleCustomerAuthOrderAccessKind,
} from '../eligibility';

type OrderRowBase = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'id'
  | 'order_number'
  | 'current_status'
  | 'payable_until'
  | 'created_at'
  | 'grand_total_cents'
>;

export type CustomerOrdersListRowItem = {
  line_position: number;
  product_name: string;
  brand_name: string;
  item_snapshot: Json;
};

export type CustomerOrdersListRow = OrderRowBase & {
  order_items?: CustomerOrdersListRowItem[] | null;
};

export type CustomerOrderLeadItem = {
  productName: string;
  brandName: string;
  productImage: SanityRawImage | null;
};

export type CustomerOrdersListItem = {
  id: string;
  orderNumber: string;
  currentStatus: string;
  payableUntil: string;
  createdAt: string;
  grandTotalCents: number;
  accessKind: CustomerAuthOrderAccessKind;
  leadItem: CustomerOrderLeadItem | null;
  totalItemCount: number;
};

export type CustomerOrdersPageResult = {
  orders: CustomerOrdersListItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  sortBy: CustomerOrdersSortBy;
};

export type LoadCustomerOrdersForPanelInput = {
  normalizedEmail: string;
  page?: number;
  pageSize?: number;
  sortBy?: CustomerOrdersSortBy;
  now?: Date;
};

export const CUSTOMER_ORDERS_LIST_SELECT =
  'id, order_number, current_status, payable_until, created_at, grand_total_cents, order_items(line_position, product_name, brand_name, item_snapshot)';

const CUSTOMER_ORDERS_VISIBLE_STATUS_FILTER = [
  `current_status.in.(${CUSTOMER_AUTH_VISIBLE_ORDER_STATUSES.join(',')})`,
  'and(current_status.eq.awaiting_payment,payable_until.gt.__NOW__)',
].join(',');

function extractProductImage(snapshot: Json | null): SanityRawImage | null {
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

function pickLeadItem(
  orderItems: CustomerOrdersListRowItem[] | null | undefined,
): CustomerOrderLeadItem | null {
  if (!orderItems || orderItems.length === 0) {
    return null;
  }

  const lead = [...orderItems].sort(
    (a, b) => a.line_position - b.line_position,
  )[0];

  if (!lead) {
    return null;
  }

  return {
    productName: lead.product_name,
    brandName: lead.brand_name,
    productImage: extractProductImage(lead.item_snapshot),
  };
}

export function mapCustomerOrdersListRow(
  order: CustomerOrdersListRow,
  now: Date = new Date(),
): CustomerOrdersListItem {
  return {
    id: order.id,
    orderNumber: order.order_number,
    currentStatus: order.current_status,
    payableUntil: order.payable_until,
    createdAt: order.created_at,
    grandTotalCents: order.grand_total_cents,
    accessKind: classifyCustomerAuthOrderAccess(order, now),
    leadItem: pickLeadItem(order.order_items),
    totalItemCount: order.order_items?.length ?? 0,
  };
}

function resolveOrdersSort(sortBy: CustomerOrdersSortBy): {
  column: 'created_at' | 'grand_total_cents';
  ascending: boolean;
} {
  switch (sortBy) {
    case 'oldest':
      return { column: 'created_at', ascending: true };
    case 'totalDesc':
      return { column: 'grand_total_cents', ascending: false };
    case 'totalAsc':
      return { column: 'grand_total_cents', ascending: true };
    case 'newest':
    default:
      return { column: 'created_at', ascending: false };
  }
}

export async function loadCustomerOrdersForPanel(
  input: LoadCustomerOrdersForPanelInput,
): Promise<CustomerOrdersPageResult> {
  const {
    normalizedEmail,
    page = 1,
    pageSize = CUSTOMER_ORDERS_ITEMS_PER_PAGE,
    sortBy = 'newest',
    now = new Date(),
  } = input;
  const currentPage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const offset = (currentPage - 1) * safePageSize;
  const rangeEnd = offset + safePageSize - 1;
  const sort = resolveOrdersSort(sortBy);
  const supabase = createAdminClient();

  const { data, error, count } = await supabase
    .from('orders')
    .select(CUSTOMER_ORDERS_LIST_SELECT, { count: 'exact' })
    .ilike('customer_email', normalizedEmail)
    .or(
      CUSTOMER_ORDERS_VISIBLE_STATUS_FILTER.replace(
        '__NOW__',
        now.toISOString(),
      ),
    )
    .order(sort.column, { ascending: sort.ascending })
    .range(offset, rangeEnd);

  if (error) {
    throw error;
  }

  const orders = ((data ?? []) as unknown as CustomerOrdersListRow[])
    .map((order) => mapCustomerOrdersListRow(order, now))
    .filter((order) => isEligibleCustomerAuthOrderAccessKind(order.accessKind));
  const totalCount = count ?? 0;

  return {
    orders,
    totalCount,
    currentPage,
    pageSize: safePageSize,
    totalPages: Math.ceil(totalCount / safePageSize),
    sortBy,
  };
}
