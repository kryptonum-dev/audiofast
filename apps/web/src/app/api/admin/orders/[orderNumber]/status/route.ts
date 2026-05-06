import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import { updateAdminOrderStatus } from '@/src/global/b2c/admin/server/order-status';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminOrderStatusRouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function POST(
  request: Request,
  { params }: AdminOrderStatusRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_order_status_update_failed',
    errorMessage: 'Could not update the B2C order status.',
    params,
    handler: async ({ params: routeParams, verified }) => {
      const result = await updateAdminOrderStatus({
        actor: verified.operator,
        input: await request.json(),
        orderNumber: decodeURIComponent(routeParams.orderNumber),
      });

      return adminJson(request, {
        ok: true,
        data: result,
      });
    },
  });
}
