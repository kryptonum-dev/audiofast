import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import { loadAdminCouponProducts } from '@/src/global/b2c/admin/server/coupon-products';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function GET(request: Request) {
  return withAdminRoute(request, {
    errorCode: 'admin_coupon_products_load_failed',
    errorMessage: 'Could not load B2C coupon products.',
    handler: async () => {
      const products = await loadAdminCouponProducts();

      return adminJson(request, {
        ok: true,
        data: {
          products,
        },
      });
    },
  });
}
