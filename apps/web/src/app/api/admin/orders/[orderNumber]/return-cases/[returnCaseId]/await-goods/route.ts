import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import { markAdminOrderReturnCaseAwaitingGoods } from '@/src/global/b2c/admin/server/order-cases';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminOrderReturnCaseAwaitGoodsRouteContext = {
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
  { params }: AdminOrderReturnCaseAwaitGoodsRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_order_return_case_await_goods_failed',
    errorMessage: 'Could not mark the B2C return case as awaiting goods.',
    params,
    handler: async ({ params: routeParams }) => {
      const result = await markAdminOrderReturnCaseAwaitingGoods({
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
