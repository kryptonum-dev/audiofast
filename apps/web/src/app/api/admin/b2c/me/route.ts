import type {
  AdminAccessMode,
  VerifiedAdminOperator,
} from '@/src/global/b2c/admin/server/auth';
import {
  adminJson,
  adminOptions,
} from '@/src/global/b2c/admin/server/http';
import { withAdminRoute } from '@/src/global/b2c/admin/server/route';

type AdminBridgeResponse =
  | {
      ok: true;
      operator: VerifiedAdminOperator;
      access: {
        allowed: true;
        mode: AdminAccessMode;
      };
    }
  | {
      ok: false;
      error:
        | 'missing_authorization'
        | 'invalid_authorization'
        | 'sanity_verification_failed'
        | 'project_access_required'
        | 'operator_not_allowed'
        | 'admin_allowlist_not_configured'
        | 'admin_sanity_config_missing'
        | 'admin_cors_config_missing'
        | 'origin_not_allowed';
      message: string;
    };

export async function OPTIONS(request: Request) {
  return adminOptions(request);
}

export async function GET(request: Request) {
  return withAdminRoute(request, {
    errorCode: 'sanity_verification_failed',
    errorMessage: 'The Sanity bearer token could not be verified.',
    handler: async ({ verified }) =>
      adminJson<AdminBridgeResponse>(
        request,
        {
          ok: true,
          operator: verified.operator,
          access: verified.access,
        },
        200,
      ),
  });
}
