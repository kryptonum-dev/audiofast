import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import { completeAdminOrderReturnCase } from '@/src/global/b2c/admin/server/order-cases';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminOrderReturnCaseCompleteRouteContext = {
  params: Promise<{
    orderNumber: string;
    returnCaseId: string;
  }>;
};

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function POST(
  request: Request,
  { params }: AdminOrderReturnCaseCompleteRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_order_return_case_complete_failed',
    errorMessage: 'Could not complete the B2C return case.',
    params,
    handler: async ({ params: routeParams, verified }) => {
      const result = await completeAdminOrderReturnCase({
        actor: verified.operator,
        input: await request.json(),
        orderNumber: decodeURIComponent(routeParams.orderNumber),
        returnCaseId: decodeURIComponent(routeParams.returnCaseId),
      });

      return adminJson(request, {
        ok: true,
        data: result,
      });
    },
  });
}
