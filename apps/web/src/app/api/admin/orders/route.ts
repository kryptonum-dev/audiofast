import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import { loadAdminOrders } from '@/src/global/b2c/admin/server/orders';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function GET(request: Request) {
  return withAdminRoute(request, {
    errorCode: 'admin_orders_load_failed',
    errorMessage: 'Could not load B2C admin orders.',
    handler: async () => {
      const url = new URL(request.url);
      const result = await loadAdminOrders({
        searchParams: url.searchParams,
      });

      return adminJson(request, {
        ok: true,
        data: result,
      });
    },
  });
}
