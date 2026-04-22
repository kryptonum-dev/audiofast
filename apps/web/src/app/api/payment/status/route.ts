import { NextResponse } from 'next/server';

import type { P24StatusNotificationPayload } from '@/src/global/b2c/checkout/payment-contracts';
import { handleCheckoutPaymentStatusNotification } from '@/src/global/b2c/checkout/server/payment-status';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as P24StatusNotificationPayload;
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
