import { createClient, type CurrentSanityUser } from '@sanity/client';
import { NextResponse } from 'next/server';

type VerifiedSanityOperator = {
  id: string;
  email: string;
  name: string;
  profileImage: string | null;
  role: string;
  projectRole: string | null;
};

type AdminBridgeResponse =
  | {
      ok: true;
      operator: VerifiedSanityOperator;
      access: {
        allowed: true;
        mode: 'allowlist' | 'development_project_member';
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

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAllowedOrigins(): Set<string> | null {
  const allowedOrigins = parseCsvEnv(process.env.B2C_ADMIN_ALLOWED_ORIGINS);

  return allowedOrigins.length > 0 ? new Set(allowedOrigins) : null;
}

function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  if (!origin || !allowedOrigins?.has(origin)) {
    return {
      Vary: 'Origin',
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  };
}

function jsonResponse(
  request: Request,
  body: AdminBridgeResponse,
  status: number,
) {
  return NextResponse.json(body, {
    status,
    headers: getCorsHeaders(request),
  });
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() ?? null;
}

function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' &&
      process.env.VERCEL_ENV !== 'preview')
  );
}

function isOperatorAllowlisted(user: CurrentSanityUser): boolean {
  const allowedEmails = parseCsvEnv(process.env.B2C_ADMIN_ALLOWED_EMAILS).map(
    (email) => email.toLowerCase(),
  );
  const allowedUserIds = parseCsvEnv(process.env.B2C_ADMIN_ALLOWED_USER_IDS);

  return (
    allowedEmails.includes(user.email.toLowerCase()) ||
    allowedUserIds.includes(user.id)
  );
}

function hasConfiguredAllowlist(): boolean {
  return (
    parseCsvEnv(process.env.B2C_ADMIN_ALLOWED_EMAILS).length > 0 ||
    parseCsvEnv(process.env.B2C_ADMIN_ALLOWED_USER_IDS).length > 0
  );
}

function getAdminSanityConfig(): {
  projectId: string;
  dataset: string;
  organizationId: string;
  apiVersion: string;
} | null {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const organizationId = process.env.B2C_ADMIN_SANITY_ORGANIZATION_ID;
  const apiVersion =
    process.env.B2C_ADMIN_SANITY_API_VERSION ??
    process.env.NEXT_PUBLIC_SANITY_API_VERSION;

  if (!projectId || !dataset || !organizationId || !apiVersion) {
    return null;
  }

  return {
    projectId,
    dataset,
    organizationId,
    apiVersion,
  };
}

async function verifySanityOperator(token: string): Promise<{
  user: CurrentSanityUser;
  projectRole: string | null;
}> {
  const sanityConfig = getAdminSanityConfig();

  if (!sanityConfig) {
    throw new Error('admin_sanity_config_missing');
  }

  const sanityClient = createClient({
    projectId: sanityConfig.projectId,
    dataset: sanityConfig.dataset,
    apiVersion: sanityConfig.apiVersion,
    token,
    useCdn: false,
  });

  const user = await sanityClient.users.getById('me');
  const projects = await sanityClient.projects.list({
    includeMembers: true,
    organizationId: sanityConfig.organizationId,
  });
  const project = projects.find(
    (candidate) => candidate.id === sanityConfig.projectId,
  );
  const currentMember = project?.members.find((member) => member.isCurrentUser);

  if (!project || !currentMember) {
    throw new Error('project_access_required');
  }

  return {
    user,
    projectRole: currentMember.role,
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  if (!allowedOrigins) {
    return jsonResponse(
      request,
      {
        ok: false,
        error: 'admin_cors_config_missing',
        message: 'B2C admin allowed origins are not configured.',
      },
      500,
    );
  }

  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse(
      request,
      {
        ok: false,
        error: 'origin_not_allowed',
        message: 'This origin is not allowed to call the B2C admin API.',
      },
      403,
    );
  }

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: Request) {
  if (!getAllowedOrigins()) {
    return jsonResponse(
      request,
      {
        ok: false,
        error: 'admin_cors_config_missing',
        message: 'B2C admin allowed origins are not configured.',
      },
      500,
    );
  }

  const token = getBearerToken(request);

  if (!token) {
    return jsonResponse(
      request,
      {
        ok: false,
        error: 'missing_authorization',
        message: 'Missing Sanity bearer token.',
      },
      401,
    );
  }

  let verified: Awaited<ReturnType<typeof verifySanityOperator>>;

  try {
    verified = await verifySanityOperator(token);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'admin_sanity_config_missing'
    ) {
      return jsonResponse(
        request,
        {
          ok: false,
          error: 'admin_sanity_config_missing',
          message: 'B2C admin Sanity configuration is missing.',
        },
        500,
      );
    }

    const projectAccessRequired =
      error instanceof Error && error.message === 'project_access_required';

    return jsonResponse(
      request,
      {
        ok: false,
        error: projectAccessRequired
          ? 'project_access_required'
          : 'sanity_verification_failed',
        message: projectAccessRequired
          ? 'The Sanity user does not have access to the Audiofast project.'
          : 'The Sanity bearer token could not be verified.',
      },
      401,
    );
  }

  const allowlisted = isOperatorAllowlisted(verified.user);
  const hasAllowlist = hasConfiguredAllowlist();
  const allowDevelopmentProjectMember = !isProductionRuntime() && !hasAllowlist;
  const allowed = allowlisted || allowDevelopmentProjectMember;

  if (!allowed) {
    return jsonResponse(
      request,
      {
        ok: false,
        error: hasAllowlist
          ? 'operator_not_allowed'
          : 'admin_allowlist_not_configured',
        message: hasAllowlist
          ? 'This Sanity user is not allowed to access B2C admin.'
          : 'B2C admin allowlist is not configured for this environment.',
      },
      403,
    );
  }

  return jsonResponse(
    request,
    {
      ok: true,
      operator: {
        id: verified.user.id,
        email: verified.user.email,
        name: verified.user.name,
        profileImage: verified.user.profileImage,
        role: verified.user.role,
        projectRole: verified.projectRole,
      },
      access: {
        allowed: true,
        mode: allowlisted ? 'allowlist' : 'development_project_member',
      },
    },
    200,
  );
}
