import { adminJson, adminOptions } from '@/src/global/b2c/admin/server/http';
import { updateAdminOrderDeliveryEstimate } from '@/src/global/b2c/admin/server/order-delivery-estimate';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminOrderDeliveryEstimateRouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function PUT(
  request: Request,
  { params }: AdminOrderDeliveryEstimateRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_order_delivery_estimate_update_failed',
    errorMessage: 'Could not update the B2C order delivery estimate.',
    params,
    handler: async ({ params: routeParams }) => {
      const result = await updateAdminOrderDeliveryEstimate({
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
