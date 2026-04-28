import { NextResponse } from 'next/server';

import { buildCustomerAccountGatewayHref } from '@/src/global/b2c/customer-auth/return-to';
import { createCustomerOrderInvoiceSignedUrl } from '@/src/global/b2c/customer-auth/server/order-detail';
import { loadCustomerAuthSessionUncached } from '@/src/global/b2c/customer-auth/server/session';

type CustomerOrderInvoiceRouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: CustomerOrderInvoiceRouteContext,
) {
  const { orderNumber } = await params;
  const detailPath = `/konto-klienta/zamowienia/${orderNumber}/`;
  const session = await loadCustomerAuthSessionUncached();

  if (!session.isAuthenticated) {
    return NextResponse.redirect(
      new URL(
        buildCustomerAccountGatewayHref(`${detailPath}faktura/`),
        request.url,
      ),
    );
  }

  const signedUrl = await createCustomerOrderInvoiceSignedUrl({
    orderNumber,
    normalizedEmail: session.normalizedEmail,
  });

  if (!signedUrl) {
    return NextResponse.json(
      { message: 'Invoice document is not available.' },
      { status: 404 },
    );
  }

  return NextResponse.redirect(signedUrl);
}
