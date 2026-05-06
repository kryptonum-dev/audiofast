import 'server-only';

import { createElement } from 'react';

import { OrderStatusUpdateTemplate } from '@/src/emails/order-status-update-template';
import {
  getString,
  isRecord,
  parseOrderShipmentData,
} from '@/src/global/b2c/utils/orders';
import {
  getTransactionalReplyToEmail,
  sendTransactionalEmail,
} from '@/src/global/email/service';
import type { Database } from '@/src/global/supabase/database.types';

type OrderStatusEmailRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'customer_email'
  | 'customer_snapshot'
  | 'order_number'
  | 'shipment_data'
  | 'shipped_at'
>;

export type AdminOrderStatusEmailStatus =
  | 'processing'
  | 'shipped'
  | 'cancelled'
  | 'returned';

const STATUS_EMAIL_CONTENT: Record<
  AdminOrderStatusEmailStatus,
  {
    label: string;
    message: string;
    subject: (orderNumber: string) => string;
  }
> = {
  processing: {
    label: 'w realizacji',
    message:
      'Zespół Audiofast rozpoczął obsługę zamówienia. Poinformujemy Cię, gdy przesyłka zostanie nadana.',
    subject: (orderNumber) => `Zamówienie ${orderNumber} jest w realizacji`,
  },
  shipped: {
    label: 'wysłane',
    message:
      'Zamówienie zostało wysłane. Jeżeli numer śledzenia jest już dostępny, znajdziesz go poniżej.',
    subject: (orderNumber) => `Zamówienie ${orderNumber} zostało wysłane`,
  },
  cancelled: {
    label: 'anulowane',
    message:
      'Zamówienie zostało anulowane. W razie pytań odpowiedz na tę wiadomość lub skontaktuj się z zespołem Audiofast.',
    subject: (orderNumber) => `Zamówienie ${orderNumber} zostało anulowane`,
  },
  returned: {
    label: 'zwrócone',
    message:
      'Obsługa zwrotu została zakończona po stronie Audiofast. W razie pytań odpowiedz na tę wiadomość.',
    subject: (orderNumber) =>
      `Zwrot zamówienia ${orderNumber} został zakończony`,
  },
};

export function getAdminOrderStatusEmailStatus(
  status: string,
): AdminOrderStatusEmailStatus | null {
  return status === 'processing' ||
    status === 'shipped' ||
    status === 'cancelled' ||
    status === 'returned'
    ? status
    : null;
}

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

  await sendTransactionalEmail({
    to: {
      email: args.order.customer_email,
    },
    subject: content.subject(args.order.order_number),
    replyTo: getTransactionalReplyToEmail(),
    saveToSentItems: true,
    react: createElement(OrderStatusUpdateTemplate, {
      customerFirstName: getCustomerFirstName(args.order.customer_snapshot),
      loginUrl: '/konto-klienta/',
      message: content.message,
      orderNumber: args.order.order_number,
      statusLabel: content.label,
      trackingNumber:
        args.status === 'shipped' ? (shipment?.trackingNumber ?? null) : null,
      trackingUrl:
        args.status === 'shipped' ? (shipment?.trackingUrl ?? null) : null,
    }),
  });
}
