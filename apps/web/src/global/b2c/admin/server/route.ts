import {
  AdminAuthError,
  verifyAdminRequest,
  type VerifiedAdminRequest,
} from '@/src/global/b2c/admin/server/auth';
import {
  adminErrorJson,
  hasAdminAllowedOrigins,
} from '@/src/global/b2c/admin/server/http';

type AdminRouteError = Error & {
  code: string;
  status: number;
};

export type AdminRouteHandlerContext<TParams> = {
  params: TParams;
  request: Request;
  verified: VerifiedAdminRequest;
};

export async function withAdminRoute<TParams>(
  request: Request,
  args: {
    errorCode: string;
    errorMessage: string;
    handler: (context: AdminRouteHandlerContext<TParams>) => Promise<Response>;
    params?: Promise<TParams>;
  },
): Promise<Response> {
  if (!hasAdminAllowedOrigins()) {
    return adminErrorJson(
      request,
      'admin_cors_config_missing',
      'B2C admin allowed origins are not configured.',
      500,
    );
  }

  try {
    const [verified, params] = await Promise.all([
      verifyAdminRequest(request),
      args.params ?? Promise.resolve({} as TParams),
    ]);

    return await args.handler({
      params,
      request,
      verified,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return adminErrorJson(request, error.code, error.message, error.status);
    }

    if (isAdminRouteError(error)) {
      return adminErrorJson(request, error.code, error.message, error.status);
    }

    console.error(args.errorMessage, error);

    return adminErrorJson(request, args.errorCode, args.errorMessage, 500);
  }
}

function isAdminRouteError(error: unknown): error is AdminRouteError {
  return (
    error instanceof Error &&
    typeof (error as AdminRouteError).code === 'string' &&
    typeof (error as AdminRouteError).status === 'number'
  );
}
