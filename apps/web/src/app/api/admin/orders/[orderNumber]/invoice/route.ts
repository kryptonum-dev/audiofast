import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import {
  AdminOrderInvoiceError,
  attachAdminOrderInvoice,
  removeAdminOrderInvoice,
} from '@/src/global/b2c/admin/server/order-invoice';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminOrderInvoiceRouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

function getInvoiceFile(formData: FormData): File {
  const file = formData.get('file');

  if (!(file instanceof File)) {
    throw new AdminOrderInvoiceError(
      'file is required.',
      'invalid_invoice_payload',
      400,
    );
  }

  return file;
}

function getOptionalFormString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' ? value : null;
}

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function POST(
  request: Request,
  { params }: AdminOrderInvoiceRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_order_invoice_attach_failed',
    errorMessage: 'Could not attach the B2C order invoice.',
    params,
    handler: async ({ params: routeParams, verified }) => {
      const formData = await request.formData();
      const result = await attachAdminOrderInvoice({
        actor: verified.operator,
        attachedAt: getOptionalFormString(formData, 'attachedAt'),
        file: getInvoiceFile(formData),
        orderNumber: decodeURIComponent(routeParams.orderNumber),
      });

      return adminJson(request, {
        ok: true,
        data: result,
      });
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: AdminOrderInvoiceRouteContext,
) {
  return withAdminRoute(request, {
    errorCode: 'admin_order_invoice_remove_failed',
    errorMessage: 'Could not remove the B2C order invoice.',
    params,
    handler: async ({ params: routeParams }) => {
      const result = await removeAdminOrderInvoice({
        orderNumber: decodeURIComponent(routeParams.orderNumber),
      });

      return adminJson(request, {
        ok: true,
        data: result,
      });
    },
  });
}
