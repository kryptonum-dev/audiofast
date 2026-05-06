import {
  adminOptions,
  getAdminCorsHeaders,
} from '@/src/global/b2c/admin/server/http';
import { loadAdminOrderInvoiceDocument } from '@/src/global/b2c/admin/server/order-invoice';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminOrderInvoiceDownloadRouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function GET(
  request: Request,
  { params }: AdminOrderInvoiceDownloadRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_order_invoice_download_failed',
    errorMessage: 'Could not download the B2C order invoice.',
    params,
    handler: async ({ params: routeParams }) => {
      const document = await loadAdminOrderInvoiceDocument({
        orderNumber: decodeURIComponent(routeParams.orderNumber),
      });
      const headers = new Headers(getAdminCorsHeaders(request));

      headers.set('content-type', document.contentType);
      headers.set(
        'content-disposition',
        `inline; filename="${document.filename}"; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
      );
      headers.set('cache-control', 'private, no-store');

      return new Response(document.body.stream(), {
        headers,
        status: 200,
      });
    },
  });
}
