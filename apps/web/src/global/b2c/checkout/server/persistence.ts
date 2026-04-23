import type { PostgrestError } from '@supabase/supabase-js';

import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';

import type { CheckoutOrderDraft } from '../order-draft';
import type { PersistCheckoutOrderResult } from './types';

type OrdersInsert = Database['public']['Tables']['orders']['Insert'];
type OrderItemsInsert = Database['public']['Tables']['order_items']['Insert'];

export class CheckoutPersistenceError extends Error {
  constructor(
    message: string,
    public readonly code: 'duplicate_order_number' | 'database_error',
    public readonly causeError: PostgrestError | Error | null = null,
  ) {
    super(message);
    this.name = 'CheckoutPersistenceError';
  }
}

function isDuplicateOrderNumberError(error: PostgrestError): boolean {
  return error.code === '23505' && error.message.includes('order_number');
}

function getCheckoutOrderCreatedAt(orderDraft: CheckoutOrderDraft): string {
  return orderDraft.statusHistory[0]?.changedAt ?? new Date().toISOString();
}

export function mapCheckoutOrderDraftToOrdersInsert(args: {
  orderNumber: string;
  orderDraft: CheckoutOrderDraft;
}): OrdersInsert {
  const createdAt = getCheckoutOrderCreatedAt(args.orderDraft);

  return {
    order_number: args.orderNumber,
    customer_profile_id: args.orderDraft.customerProfileId,
    customer_email: args.orderDraft.customerEmail,
    current_status: args.orderDraft.currentStatus,
    status_history: args.orderDraft.statusHistory,
    payable_until: args.orderDraft.payableUntil,
    payment_provider: args.orderDraft.paymentProvider,
    payment_reference: args.orderDraft.paymentReference,
    payment_verified_at: args.orderDraft.paymentVerifiedAt,
    profile_persistence: args.orderDraft.profilePersistence,
    customer_snapshot: args.orderDraft.customerSnapshot,
    shipping_address_snapshot: args.orderDraft.shippingAddressSnapshot,
    subtotal_cents: args.orderDraft.subtotalCents,
    discount_total_cents: args.orderDraft.discountTotalCents,
    grand_total_cents: args.orderDraft.grandTotalCents,
    used_discount: args.orderDraft.usedDiscount,
    shipment_data: args.orderDraft.shipmentData,
    invoice_data: args.orderDraft.invoiceData,
    created_at: createdAt,
    updated_at: createdAt,
    paid_at: args.orderDraft.paidAt,
    shipped_at: null,
    completed_at: null,
    cancelled_at: null,
    returned_at: null,
  };
}

export function mapCheckoutOrderDraftToOrderItemsInsert(args: {
  orderId: string;
  orderDraft: CheckoutOrderDraft;
}): OrderItemsInsert[] {
  const createdAt = getCheckoutOrderCreatedAt(args.orderDraft);

  return args.orderDraft.items.map((item) => ({
    order_id: args.orderId,
    line_type: item.lineType,
    line_position: item.linePosition,
    quantity: item.quantity,
    product_key: item.productKey,
    product_name: item.productName,
    brand_name: item.brandName,
    unit_price_cents: item.unitPriceCents,
    line_subtotal_cents: item.lineSubtotalCents,
    line_discount_total_cents: item.lineDiscountTotalCents,
    line_total_cents: item.lineTotalCents,
    item_snapshot: item.itemSnapshot,
    is_returnable: item.isReturnable,
    created_at: createdAt,
    updated_at: createdAt,
  }));
}

async function cleanupFailedOrderInsert(orderId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('orders').delete().eq('id', orderId);
  } catch (cleanupError) {
    console.error('Failed to clean up partially persisted checkout order.', {
      orderId,
      cleanupError,
    });
  }
}

export async function persistCheckoutOrder(args: {
  orderNumber: string;
  orderDraft: CheckoutOrderDraft;
}): Promise<PersistCheckoutOrderResult> {
  const supabase = createAdminClient();
  const orderInsert = mapCheckoutOrderDraftToOrdersInsert(args);

  const { data: orderRow, error: orderInsertError } = await supabase
    .from('orders')
    .insert(orderInsert)
    .select('id, order_number, created_at')
    .single();

  if (orderInsertError) {
    throw new CheckoutPersistenceError(
      'Failed to persist checkout order.',
      isDuplicateOrderNumberError(orderInsertError)
        ? 'duplicate_order_number'
        : 'database_error',
      orderInsertError,
    );
  }

  const orderItemsInsert = mapCheckoutOrderDraftToOrderItemsInsert({
    orderId: orderRow.id,
    orderDraft: args.orderDraft,
  });

  const { data: orderItems, error: orderItemsInsertError } = await supabase
    .from('order_items')
    .insert(orderItemsInsert)
    .select('id');

  if (orderItemsInsertError) {
    await cleanupFailedOrderInsert(orderRow.id);

    throw new CheckoutPersistenceError(
      'Failed to persist checkout order items.',
      'database_error',
      orderItemsInsertError,
    );
  }

  return {
    orderId: orderRow.id,
    orderNumber: orderRow.order_number,
    createdAt: orderRow.created_at,
    orderDraft: args.orderDraft,
    insertedItemCount: orderItems?.length ?? orderItemsInsert.length,
  };
}
