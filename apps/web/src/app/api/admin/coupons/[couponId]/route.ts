import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import {
  archiveAdminCoupon,
  loadAdminCoupon,
  updateAdminCoupon,
} from '@/src/global/b2c/admin/server/coupons';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminCouponRouteContext = {
  params: Promise<{
    couponId: string;
  }>;
};

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function GET(request: Request, { params }: AdminCouponRouteContext) {
  return withAdminRoute(request, {
    errorCode: 'admin_coupon_load_failed',
    errorMessage: 'Could not load the B2C coupon.',
    params,
    handler: async ({ params: routeParams }) => {
      const coupon = await loadAdminCoupon({
        couponId: decodeURIComponent(routeParams.couponId),
      });

      return adminJson(request, {
        ok: true,
        data: coupon,
      });
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: AdminCouponRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_coupon_update_failed',
    errorMessage: 'Could not update the B2C coupon.',
    params,
    handler: async ({ params: routeParams }) => {
      const coupon = await updateAdminCoupon({
        couponId: decodeURIComponent(routeParams.couponId),
        input: await request.json(),
      });

      return adminJson(request, {
        ok: true,
        data: coupon,
      });
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: AdminCouponRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_coupon_archive_failed',
    errorMessage: 'Could not archive the B2C coupon.',
    params,
    handler: async ({ params: routeParams }) => {
      const coupon = await archiveAdminCoupon({
        couponId: decodeURIComponent(routeParams.couponId),
      });

      return adminJson(request, {
        ok: true,
        data: coupon,
      });
    },
  });
}
