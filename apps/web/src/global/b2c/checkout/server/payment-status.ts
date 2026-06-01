import 'server-only';

import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';

import type { CheckoutOrderStatus } from '../order-draft';
import type {
  P24Currency,
  P24StatusNotificationPayload,
  P24TransactionNotificationStatus,
  P24VerificationInput,
} from '../payment-contracts';
import { getP24Mode, loadP24Config } from './p24-config';
import { buildP24VerificationSign } from './p24-sign';
import {
  type PaymentConfirmationEmailOrderData,
  sendCheckoutPaymentConfirmationEmail,
} from './payment-confirmation-email';
import { persistPaidCheckoutOrderProfile } from './payment-profile-persistence';
import { getCheckoutPaymentProviderAdapter } from './payment-provider';
import { confirmCheckoutOrderPayment } from './payment-update';

type OrderStatusNotificationRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  'current_status' | 'payment_session_id'
> &
  PaymentConfirmationEmailOrderData;

const MOCK_P24_CRC = 'mock-p24-crc';
const P24_CURRENCY: P24Currency = 'PLN';

function getP24VerificationCrc(): string {
  return getP24Mode() === 'mock' ? MOCK_P24_CRC : loadP24Config().crc;
}

function normalizeOrderStatus(value: string): CheckoutOrderStatus {
  if (value === 'awaiting_confirmation' || value === 'paid') {
    return value;
  }

  return 'awaiting_payment';
}

function isPaymentConfirmedStatus(status: CheckoutOrderStatus): boolean {
  return status === 'awaiting_confirmation' || status === 'paid';
}

function isSuccessfulProviderStatus(
  status: P24TransactionNotificationStatus,
): boolean {
  return status === 'done';
}

async function loadOrderForPaymentStatus(
  notification: P24StatusNotificationPayload,
): Promise<OrderStatusNotificationRow | null> {
  const supabase = createAdminClient();
  const select =
    'customer_email, customer_snapshot, current_status, discount_total_cents, grand_total_cents, id, invoice_data, order_number, payment_session_id, shipping_address_snapshot, subtotal_cents';
  const { data, error } = await supabase
    .from('orders')
    .select(select)
    .eq('payment_session_id', notification.sessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from('orders')
    .select(select)
    .eq('order_number', notification.sessionId)
    .maybeSingle();

  if (legacyError) {
    throw legacyError;
  }

  return legacyData;
}

function buildVerificationInputFromNotification(args: {
  notification: P24StatusNotificationPayload;
  order: OrderStatusNotificationRow;
}): P24VerificationInput {
  return {
    provider: args.notification.provider,
    checkoutOrderId: args.order.id,
    orderNumber: args.order.order_number,
    merchantId: args.notification.merchantId,
    posId: args.notification.posId,
    sessionId: args.notification.sessionId,
    amount: args.order.grand_total_cents,
    currency: P24_CURRENCY,
    orderId: args.notification.orderId,
    sign: buildP24VerificationSign({
      sessionId: args.notification.sessionId,
      orderId: args.notification.orderId,
      amount: args.order.grand_total_cents,
      currency: P24_CURRENCY,
      crc: getP24VerificationCrc(),
    }),
    paymentId: args.notification.result.paymentId,
  };
}

export type HandleCheckoutPaymentStatusResult = {
  orderId: string;
  orderNumber: string;
  providerStatus: P24TransactionNotificationStatus;
  currentStatus: CheckoutOrderStatus;
  wasConfirmed: boolean;
  wasAlreadyPaid: boolean;
};

export async function handleCheckoutPaymentStatusNotification(args: {
  notification: P24StatusNotificationPayload;
}): Promise<HandleCheckoutPaymentStatusResult> {
  const order = await loadOrderForPaymentStatus(args.notification);

  if (order === null) {
    throw new Error(
      `Checkout order for payment session ${args.notification.sessionId} was not found for payment status processing.`,
    );
  }

  if (!isSuccessfulProviderStatus(args.notification.result.generalStatus)) {
    const currentStatus = normalizeOrderStatus(order.current_status);

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      providerStatus: args.notification.result.generalStatus,
      currentStatus,
      wasConfirmed: false,
      wasAlreadyPaid: isPaymentConfirmedStatus(currentStatus),
    };
  }

  const providerAdapter = getCheckoutPaymentProviderAdapter(
    args.notification.provider,
  );
  const verificationInput = buildVerificationInputFromNotification({
    notification: args.notification,
    order,
  });
  const verification =
    await providerAdapter.verifyTransaction(verificationInput);

  if (!verification.isVerified || !verification.verifiedAt) {
    throw new Error(
      `Checkout payment verification failed for order ${order.order_number}.`,
    );
  }

  const paymentUpdate = await confirmCheckoutOrderPayment({
    orderId: order.id,
    paymentReference:
      verification.providerReference ?? args.notification.result.paymentId,
    verifiedAt: verification.verifiedAt,
  });

  if (!paymentUpdate.wasAlreadyPaid) {
    try {
      await sendCheckoutPaymentConfirmationEmail({
        order,
      });
    } catch (error) {
      console.error(
        'Failed to send checkout payment confirmation email after payment confirmation.',
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
      'Failed to persist checkout customer profile data after payment confirmation.',
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
    providerStatus: args.notification.result.generalStatus,
    currentStatus: paymentUpdate.currentStatus,
    wasConfirmed: true,
    wasAlreadyPaid: paymentUpdate.wasAlreadyPaid,
  };
}
