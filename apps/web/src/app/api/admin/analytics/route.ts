import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import { loadAdminAnalytics } from '@/src/global/b2c/admin/server/analytics';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function GET(request: Request) {
  return withAdminRoute(request, {
    errorCode: 'admin_analytics_load_failed',
    errorMessage: 'Could not load B2C operational analytics.',
    handler: async () => {
      const result = await loadAdminAnalytics({
        searchParams: new URL(request.url).searchParams,
      });

      return adminJson(request, {
        ok: true,
        data: result,
      });
    },
  });
}
