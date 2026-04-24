import 'server-only';

import type { User } from '@supabase/supabase-js';

import { createAdminClient } from '@/src/global/supabase/admin';

import { resolveCustomerAuthEligibility } from './eligibility';
import type {
  CustomerAuthAuthUserSummary,
  CustomerAuthBootstrapResult,
} from './types';

const AUTH_ADMIN_LIST_USERS_PAGE_SIZE = 100;

type CustomerAuthAdminClient = {
  auth: {
    admin: {
      listUsers: (params?: { page?: number; perPage?: number }) => Promise<{
        data: {
          users?: User[];
        };
        error: {
          message?: string;
        } | null;
      }>;
      createUser: (payload: {
        email: string;
        email_confirm: boolean;
      }) => Promise<{
        data: {
          user: User | null;
        };
        error: {
          message?: string;
        } | null;
      }>;
    };
  };
};

export class CustomerAuthBootstrapError extends Error {
  readonly code = 'database_error';

  constructor(
    message: string,
    readonly causeError?: unknown,
  ) {
    super(message);
    this.name = 'CustomerAuthBootstrapError';
  }
}

function getCustomerAuthAdminClient(): CustomerAuthAdminClient {
  return createAdminClient() as unknown as CustomerAuthAdminClient;
}

function mapAuthUserToSummary(
  user: Pick<
    User,
    'id' | 'email' | 'email_confirmed_at' | 'created_at' | 'last_sign_in_at'
  >,
): CustomerAuthAuthUserSummary {
  return {
    id: user.id,
    email: user.email ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
  };
}

function isMatchingAuthUserEmail(
  user: Pick<User, 'email'>,
  normalizedEmail: string,
) {
  return user.email?.trim().toLowerCase() === normalizedEmail;
}

function isDuplicateAuthUserCreateError(
  error: {
    message?: string;
  } | null,
): boolean {
  const message = error?.message?.toLowerCase() ?? '';

  return (
    message.includes('already been registered') ||
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('duplicate')
  );
}

async function loadExistingAuthUserByEmail(
  normalizedEmail: string,
): Promise<CustomerAuthAuthUserSummary | null> {
  const supabase = getCustomerAuthAdminClient();

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: AUTH_ADMIN_LIST_USERS_PAGE_SIZE,
    });

    if (error) {
      throw new CustomerAuthBootstrapError(
        'Failed to load existing auth user for customer auth bootstrap.',
        error,
      );
    }

    const users = data.users ?? [];
    const matchingUser = users.find((user) =>
      isMatchingAuthUserEmail(user, normalizedEmail),
    );

    if (matchingUser) {
      return mapAuthUserToSummary(matchingUser);
    }

    if (users.length < AUTH_ADMIN_LIST_USERS_PAGE_SIZE) {
      return null;
    }
  }
}

async function createBootstrapAuthUser(
  normalizedEmail: string,
): Promise<CustomerAuthAuthUserSummary> {
  const supabase = getCustomerAuthAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new CustomerAuthBootstrapError(
      'Failed to create auth user for eligible customer auth bootstrap.',
      error,
    );
  }

  return mapAuthUserToSummary(data.user);
}

export async function ensureCustomerAuthUserBootstrap(args: {
  email: string;
  now?: Date;
}): Promise<CustomerAuthBootstrapResult> {
  const eligibility = await resolveCustomerAuthEligibility({
    email: args.email,
    now: args.now,
  });

  if (!eligibility.isValidEmail) {
    return {
      normalizedEmail: eligibility.normalizedEmail,
      outcome: 'skipped_invalid_email',
      eligibility,
      authUser: null,
      createdAuthUser: false,
    };
  }

  if (!eligibility.isEligible || !eligibility.normalizedEmail) {
    return {
      normalizedEmail: eligibility.normalizedEmail,
      outcome: 'skipped_ineligible_email',
      eligibility,
      authUser: null,
      createdAuthUser: false,
    };
  }

  const existingAuthUser = await loadExistingAuthUserByEmail(
    eligibility.normalizedEmail,
  );

  if (existingAuthUser) {
    return {
      normalizedEmail: eligibility.normalizedEmail,
      outcome: 'existing_auth_user',
      eligibility,
      authUser: existingAuthUser,
      createdAuthUser: false,
    };
  }

  try {
    const createdAuthUser = await createBootstrapAuthUser(
      eligibility.normalizedEmail,
    );

    return {
      normalizedEmail: eligibility.normalizedEmail,
      outcome: 'created_auth_user',
      eligibility,
      authUser: createdAuthUser,
      createdAuthUser: true,
    };
  } catch (error) {
    if (
      error instanceof CustomerAuthBootstrapError &&
      isDuplicateAuthUserCreateError(
        error.causeError as {
          message?: string;
        } | null,
      )
    ) {
      const recoveredAuthUser = await loadExistingAuthUserByEmail(
        eligibility.normalizedEmail,
      );

      if (recoveredAuthUser) {
        return {
          normalizedEmail: eligibility.normalizedEmail,
          outcome: 'existing_auth_user',
          eligibility,
          authUser: recoveredAuthUser,
          createdAuthUser: false,
        };
      }
    }

    throw error;
  }
}
