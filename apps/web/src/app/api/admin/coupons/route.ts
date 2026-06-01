import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import {
  createAdminCoupon,
  loadAdminCoupons,
} from '@/src/global/b2c/admin/server/coupons';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function GET(request: Request) {
  return withAdminRoute(request, {
    errorCode: 'admin_coupons_load_failed',
    errorMessage: 'Could not load B2C coupons.',
    handler: async () => {
      const result = await loadAdminCoupons({
        searchParams: new URL(request.url).searchParams,
      });

      return adminJson(request, {
        ok: true,
        data: result,
      });
    },
  });
}

export async function POST(request: Request) {
  return withAdminRoute(request, {
    errorCode: 'admin_coupon_create_failed',
    errorMessage: 'Could not create the B2C coupon.',
    handler: async () => {
      const coupon = await createAdminCoupon({
        input: await request.json(),
      });

      return adminJson(
        request,
        {
          ok: true,
          data: coupon,
        },
        201,
      );
    },
  });
}
