import type { Json } from '@/src/global/supabase/database.types';

import type { CheckoutOrderDraft } from '../order-draft';
import {
  type PaymentConfirmationEmailOrderData,
  sendCheckoutPaymentConfirmationEmail,
} from './payment-confirmation-email';
import { persistPaidCheckoutOrderProfile } from './payment-profile-persistence';
import { confirmCheckoutOrderPayment } from './payment-update';
import type { StartCheckoutPaymentData } from './types';

type ZeroTotalCheckoutOrder = {
  orderId: string;
  orderNumber: string;
  orderDraft: CheckoutOrderDraft;
};

export function buildZeroTotalPaymentReference(orderNumber: string): string {
  return `zero-total:${orderNumber}`;
}

function mapZeroTotalOrderToPaymentConfirmationEmailOrder(
  order: ZeroTotalCheckoutOrder,
): PaymentConfirmationEmailOrderData {
  return {
    id: order.orderId,
    order_number: order.orderNumber,
    customer_email: order.orderDraft.customerEmail,
    customer_snapshot: order.orderDraft.customerSnapshot as unknown as Json,
    shipping_address_snapshot: order.orderDraft
      .shippingAddressSnapshot as unknown as Json,
    invoice_data: order.orderDraft.invoiceData as unknown as Json | null,
    subtotal_cents: order.orderDraft.subtotalCents,
    discount_total_cents: order.orderDraft.discountTotalCents,
    grand_total_cents: order.orderDraft.grandTotalCents,
  };
}

export async function completeZeroTotalCheckoutPayment(args: {
  order: ZeroTotalCheckoutOrder;
  redirectUrl: string;
}): Promise<StartCheckoutPaymentData> {
  const verifiedAt = new Date().toISOString();
  const paymentUpdate = await confirmCheckoutOrderPayment({
    orderId: args.order.orderId,
    paymentReference: buildZeroTotalPaymentReference(args.order.orderNumber),
    verifiedAt,
    expectedPaymentProvider: 'zero_total',
    enforcePayableUntil: false,
  });

  if (!paymentUpdate.wasAlreadyPaid) {
    try {
      await sendCheckoutPaymentConfirmationEmail({
        order: mapZeroTotalOrderToPaymentConfirmationEmailOrder(args.order),
      });
    } catch (error) {
      console.error(
        'Failed to send checkout payment confirmation email after zero-total checkout confirmation.',
        {
          orderId: paymentUpdate.orderId,
          orderNumber: paymentUpdate.orderNumber,
          error,
        },
      );
    }
  }

  try {
    await persistPaidCheckoutOrderProfile({
      orderId: paymentUpdate.orderId,
    });
  } catch (error) {
    console.error(
      'Failed to persist checkout customer profile data after zero-total checkout confirmation.',
      {
        orderId: paymentUpdate.orderId,
        orderNumber: paymentUpdate.orderNumber,
        wasAlreadyPaid: paymentUpdate.wasAlreadyPaid,
        error,
      },
    );
  }

  return {
    orderId: paymentUpdate.orderId,
    orderNumber: paymentUpdate.orderNumber,
    redirectUrl: args.redirectUrl,
    registration: null,
    wasAlreadyPaid: paymentUpdate.wasAlreadyPaid,
  };
}
