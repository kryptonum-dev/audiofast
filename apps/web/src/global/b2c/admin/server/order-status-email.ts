import 'server-only';

import { createElement } from 'react';

import { OrderStatusUpdateTemplate } from '@/src/emails/order-status-update-template';
import {
  formatOrderExpectedDeliveryEstimate,
  getString,
  isRecord,
  parseOrderExpectedDeliveryEstimate,
  parseOrderShipmentData,
} from '@/src/global/b2c/utils/orders';
import {
  STATUS_EMAIL_CONTENT,
  getAdminOrderStatusEmailStatus,
  type AdminOrderStatusEmailStatus,
} from '@/src/global/b2c/admin/order-status-email-content';
import { buildB2cOrderDetailEmailUrl } from '@/src/global/b2c/email-urls';
import {
  getTransactionalReplyToEmail,
  sendTransactionalEmail,
} from '@/src/global/email/service';
import type { Database } from '@/src/global/supabase/database.types';

export { getAdminOrderStatusEmailStatus };
export type { AdminOrderStatusEmailStatus };

type OrderStatusEmailRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'customer_email'
  | 'customer_snapshot'
  | 'expected_delivery_from'
  | 'expected_delivery_to'
  | 'order_number'
  | 'shipment_data'
  | 'shipped_at'
>;

function getCustomerFirstName(customerSnapshot: unknown): string {
  if (!isRecord(customerSnapshot)) {
    return 'kliencie';
  }

  return getString(customerSnapshot.firstName) ?? 'kliencie';
}

export async function sendAdminOrderStatusUpdateEmail(args: {
  order: OrderStatusEmailRow;
  status: AdminOrderStatusEmailStatus;
}): Promise<void> {
  const content = STATUS_EMAIL_CONTENT[args.status];
  const shipment = parseOrderShipmentData(
    args.order.shipment_data,
    args.order.shipped_at,
  );
  const deliveryEstimate = parseOrderExpectedDeliveryEstimate(
    args.order.expected_delivery_from,
    args.order.expected_delivery_to,
  );
  const deliveryEstimateLabel =
    args.status === 'processing' || args.status === 'shipped'
      ? formatOrderExpectedDeliveryEstimate(deliveryEstimate)
      : null;

  await sendTransactionalEmail({
    to: {
      email: args.order.customer_email,
    },
    subject: content.subject(args.order.order_number),
    replyTo: getTransactionalReplyToEmail(),
    saveToSentItems: true,
    react: createElement(OrderStatusUpdateTemplate, {
      customerFirstName: getCustomerFirstName(args.order.customer_snapshot),
      loginUrl: buildB2cOrderDetailEmailUrl(args.order.order_number),
      message: content.message,
      orderNumber: args.order.order_number,
      statusLabel: content.label,
      deliveryEstimateLabel,
      trackingNumber:
        args.status === 'shipped' ? (shipment?.trackingNumber ?? null) : null,
      trackingUrl:
        args.status === 'shipped' ? (shipment?.trackingUrl ?? null) : null,
    }),
  });
}
