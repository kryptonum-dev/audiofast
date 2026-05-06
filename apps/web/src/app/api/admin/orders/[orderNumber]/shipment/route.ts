import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import {
  updateAdminOrderShipment,
} from '@/src/global/b2c/admin/server/order-shipment';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminOrderShipmentRouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function PUT(
  request: Request,
  { params }: AdminOrderShipmentRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_order_shipment_update_failed',
    errorMessage: 'Could not update the B2C order shipment.',
    params,
    handler: async ({ params: routeParams }) => {
      const result = await updateAdminOrderShipment({
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
