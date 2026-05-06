import {
  adminErrorJson,
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import { loadAdminOrderDetail } from '@/src/global/b2c/admin/server/orders';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminOrderDetailRouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function GET(
  request: Request,
  { params }: AdminOrderDetailRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_order_detail_load_failed',
    errorMessage: 'Could not load the B2C admin order detail.',
    params,
    handler: async ({ params: routeParams }) => {
      const result = await loadAdminOrderDetail({
        orderNumber: decodeURIComponent(routeParams.orderNumber),
      });

      if (result.kind === 'not_found') {
        return adminErrorJson(
          request,
          'admin_order_not_found',
          'The requested B2C order could not be found.',
          404,
        );
      }

      return adminJson(request, {
        ok: true,
        data: result.order,
      });
    },
  });
}
