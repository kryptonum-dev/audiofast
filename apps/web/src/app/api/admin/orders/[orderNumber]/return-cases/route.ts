import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import { createAdminOrderReturnCase } from '@/src/global/b2c/admin/server/order-cases';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminOrderReturnCasesRouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function POST(
  request: Request,
  { params }: AdminOrderReturnCasesRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_order_return_case_create_failed',
    errorMessage: 'Could not create the B2C return case.',
    params,
    handler: async ({ params: routeParams }) => {
      const result = await createAdminOrderReturnCase({
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
