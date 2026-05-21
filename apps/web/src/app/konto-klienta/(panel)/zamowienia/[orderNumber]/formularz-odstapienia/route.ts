import { NextResponse } from 'next/server';

import { buildCustomerAccountGatewayHref } from '@/src/global/b2c/customer-auth/return-to';
import { loadCustomerOrderWithdrawalFormDocument } from '@/src/global/b2c/customer-auth/server/order-detail';
import { loadCustomerAuthSessionUncached } from '@/src/global/b2c/customer-auth/server/session';

type CustomerOrderWithdrawalFormRouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: CustomerOrderWithdrawalFormRouteContext,
) {
  const { orderNumber } = await params;
  const detailPath = `/konto-klienta/zamowienia/${orderNumber}/`;
  const session = await loadCustomerAuthSessionUncached();

  if (!session.isAuthenticated) {
    return NextResponse.redirect(
      new URL(
        buildCustomerAccountGatewayHref(`${detailPath}formularz-odstapienia/`),
        request.url,
      ),
    );
  }

  const document = await loadCustomerOrderWithdrawalFormDocument({
    orderNumber,
    normalizedEmail: session.normalizedEmail,
  });

  if (!document) {
    return NextResponse.json(
      { message: 'Withdrawal form is not available.' },
      { status: 404 },
    );
  }

  const headers = new Headers();
  headers.set('content-type', document.contentType || 'application/pdf');
  headers.set(
    'content-disposition',
    `attachment; filename="${document.filename}"; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
  );
  headers.set('cache-control', 'private, no-store');

  return new Response(document.body, {
    status: 200,
    headers,
  });
}
