import { NextResponse } from 'next/server';

import { buildCustomerAccountGatewayHref } from '@/src/global/b2c/customer-auth/return-to';
import { createCustomerOrderInvoiceSignedUrl } from '@/src/global/b2c/customer-auth/server/order-detail';
import { loadCustomerAuthSessionUncached } from '@/src/global/b2c/customer-auth/server/session';

type CustomerOrderInvoiceRouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

function buildInvoiceFilename(orderNumber: string) {
  return `faktura-${orderNumber}.pdf`;
}

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

  const invoiceResponse = await fetch(signedUrl, {
    cache: 'no-store',
  });

  if (!invoiceResponse.ok || !invoiceResponse.body) {
    return NextResponse.json(
      { message: 'Invoice document could not be downloaded.' },
      { status: 502 },
    );
  }

  const filename = buildInvoiceFilename(orderNumber);
  const headers = new Headers();
  headers.set(
    'content-type',
    invoiceResponse.headers.get('content-type') ?? 'application/pdf',
  );
  headers.set(
    'content-disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  headers.set('cache-control', 'private, no-store');

  const contentLength = invoiceResponse.headers.get('content-length');
  if (contentLength) {
    headers.set('content-length', contentLength);
  }

  return new Response(invoiceResponse.body, {
    status: 200,
    headers,
  });
}
