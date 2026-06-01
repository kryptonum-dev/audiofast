import { NextResponse } from 'next/server';

import {
  parseP24PaymentStatusNotification,
  P24NotificationParseError,
} from '@/src/global/b2c/checkout/server/p24-notification';
import { handleCheckoutPaymentStatusNotification } from '@/src/global/b2c/checkout/server/payment-status';

export async function POST(request: Request) {
  try {
    const payload = parseP24PaymentStatusNotification(await request.json());
    const result = await handleCheckoutPaymentStatusNotification({
      notification: payload,
    });

    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      providerStatus: result.providerStatus,
      currentStatus: result.currentStatus,
      wasConfirmed: result.wasConfirmed,
      wasAlreadyPaid: result.wasAlreadyPaid,
    });
  } catch (error) {
    if (error instanceof P24NotificationParseError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'payment_status_notification_invalid',
        },
        { status: error.status },
      );
    }

    console.error('Failed to process payment status notification.', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'payment_status_processing_failed',
      },
      { status: 500 },
    );
  }
}
