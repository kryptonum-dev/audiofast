import 'server-only';

import { createClient, type CurrentSanityUser } from '@sanity/client';

export type AdminAccessMode = 'allowlist' | 'development_project_member';

export type VerifiedAdminOperator = {
  id: string;
  email: string;
  name: string;
  profileImage: string | null;
  role: string;
  projectRole: string | null;
};

export type VerifiedAdminRequest = {
  operator: VerifiedAdminOperator;
  access: {
    allowed: true;
    mode: AdminAccessMode;
  };
};

export type AdminAuthErrorCode =
  | 'missing_authorization'
  | 'invalid_authorization'
  | 'sanity_verification_failed'
  | 'project_access_required'
  | 'operator_not_allowed'
  | 'admin_allowlist_not_configured'
  | 'admin_sanity_config_missing';

type AdminSanityConfig = {
  projectId: string;
  dataset: string;
  organizationId: string;
  apiVersion: string;
};

export class AdminAuthError extends Error {
  constructor(
    public readonly code: AdminAuthErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getBearerToken(request: Request): string {
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    throw new AdminAuthError(
      'missing_authorization',
      'Missing Sanity bearer token.',
      401,
    );
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    throw new AdminAuthError(
      'invalid_authorization',
      'Authorization must use a Sanity bearer token.',
      401,
    );
  }

  return token;
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

function getAdminSanityConfig(): AdminSanityConfig {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const organizationId = process.env.B2C_ADMIN_SANITY_ORGANIZATION_ID;
  const apiVersion =
    process.env.B2C_ADMIN_SANITY_API_VERSION ??
    process.env.NEXT_PUBLIC_SANITY_API_VERSION;

  if (!projectId || !dataset || !organizationId || !apiVersion) {
    throw new AdminAuthError(
      'admin_sanity_config_missing',
      'B2C admin Sanity configuration is missing.',
      500,
    );
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
  const sanityClient = createClient({
    projectId: sanityConfig.projectId,
    dataset: sanityConfig.dataset,
    apiVersion: sanityConfig.apiVersion,
    token,
    useCdn: false,
  });

  try {
    const user = await sanityClient.users.getById('me');
    const projects = await sanityClient.projects.list({
      includeMembers: true,
      organizationId: sanityConfig.organizationId,
    });
    const project = projects.find(
      (candidate) => candidate.id === sanityConfig.projectId,
    );
    const currentMember = project?.members.find(
      (member) => member.isCurrentUser,
    );

    if (!project || !currentMember) {
      throw new AdminAuthError(
        'project_access_required',
        'The Sanity user does not have access to the Audiofast project.',
        401,
      );
    }

    return {
      user,
      projectRole: currentMember.role,
    };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      throw error;
    }

    throw new AdminAuthError(
      'sanity_verification_failed',
      'The Sanity bearer token could not be verified.',
      401,
    );
  }
}

export async function verifyAdminRequest(
  request: Request,
): Promise<VerifiedAdminRequest> {
  const token = getBearerToken(request);
  const verified = await verifySanityOperator(token);
  const allowlisted = isOperatorAllowlisted(verified.user);
  const hasAllowlist = hasConfiguredAllowlist();
  const allowDevelopmentProjectMember = !isProductionRuntime() && !hasAllowlist;
  const allowed = allowlisted || allowDevelopmentProjectMember;

  if (!allowed) {
    throw new AdminAuthError(
      hasAllowlist ? 'operator_not_allowed' : 'admin_allowlist_not_configured',
      hasAllowlist
        ? 'This Sanity user is not allowed to access B2C admin.'
        : 'B2C admin allowlist is not configured for this environment.',
      403,
    );
  }

  return {
    operator: {
      id: verified.user.id,
      email: verified.user.email,
      name: verified.user.name,
      profileImage: verified.user.profileImage ?? null,
      role: verified.user.role,
      projectRole: verified.projectRole,
    },
    access: {
      allowed: true,
      mode: allowlisted ? 'allowlist' : 'development_project_member',
    },
  };
}
