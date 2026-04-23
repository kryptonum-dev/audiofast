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
import { buildP24VerificationSign } from '../payment-contracts';
import { persistPaidCheckoutOrderProfile } from './payment-profile-persistence';
import { getCheckoutPaymentProviderAdapter } from './payment-provider';
import { confirmCheckoutOrderPayment } from './payment-update';

type OrderStatusNotificationRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  'id' | 'order_number' | 'current_status' | 'grand_total_cents'
>;

const MOCK_P24_CRC = 'mock-p24-crc';
const P24_CURRENCY: P24Currency = 'PLN';

function normalizeOrderStatus(value: string): CheckoutOrderStatus {
  return value === 'paid' ? 'paid' : 'awaiting_payment';
}

function isSuccessfulProviderStatus(
  status: P24TransactionNotificationStatus,
): boolean {
  return status === 'done';
}

async function loadOrderForPaymentStatus(
  orderNumber: string,
): Promise<OrderStatusNotificationRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, current_status, grand_total_cents')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
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
      crc: MOCK_P24_CRC,
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
  const order = await loadOrderForPaymentStatus(args.notification.orderNumber);

  if (order === null) {
    throw new Error(
      `Checkout order ${args.notification.orderNumber} was not found for payment status processing.`,
    );
  }

  if (!isSuccessfulProviderStatus(args.notification.result.generalStatus)) {
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      providerStatus: args.notification.result.generalStatus,
      currentStatus: normalizeOrderStatus(order.current_status),
      wasConfirmed: false,
      wasAlreadyPaid: normalizeOrderStatus(order.current_status) === 'paid',
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
