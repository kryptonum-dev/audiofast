import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import { resolveAdminOrderCancellation } from '@/src/global/b2c/admin/server/order-cases';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminOrderCancellationResolveRouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function POST(
  request: Request,
  { params }: AdminOrderCancellationResolveRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_order_cancellation_resolve_failed',
    errorMessage: 'Could not resolve the B2C cancellation request.',
    params,
    handler: async ({ params: routeParams, verified }) => {
      const result = await resolveAdminOrderCancellation({
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
