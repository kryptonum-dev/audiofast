import 'server-only';

import type { User } from '@supabase/supabase-js';

import { createAdminClient } from '@/src/global/supabase/admin';
import { createAuthServerClient } from '@/src/global/supabase/server-auth';

import { normalizeCustomerAuthEmail } from '../email';
import type {
  CustomerAuthAuthUserSummary,
  CustomerAuthProfileSummary,
} from './types';

type CustomerProfileRow = CustomerAuthProfileSummary;

export type CustomerAuthSessionResult =
  | {
      isAuthenticated: false;
      authUser: null;
      normalizedEmail: null;
      profile: null;
    }
  | {
      isAuthenticated: true;
      authUser: CustomerAuthAuthUserSummary;
      normalizedEmail: string;
      profile: CustomerAuthProfileSummary | null;
    };

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

function mapCustomerProfileToSummary(
  profile: CustomerProfileRow,
): CustomerAuthProfileSummary {
  return {
    id: profile.id,
    email: profile.email,
    auth_user_id: profile.auth_user_id,
    first_name: profile.first_name,
    last_name: profile.last_name,
  };
}

async function loadCustomerProfileByAuthUserId(
  authUserId: string,
): Promise<CustomerProfileRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('id, email, auth_user_id, first_name, last_name')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as CustomerProfileRow | null;
}

async function loadCustomerProfileByEmail(
  normalizedEmail: string,
): Promise<CustomerProfileRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('id, email, auth_user_id, first_name, last_name')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as CustomerProfileRow | null;
}

export async function loadCustomerAuthSession(): Promise<CustomerAuthSessionResult> {
  try {
    const supabase = await createAuthServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user?.email) {
      return {
        isAuthenticated: false,
        authUser: null,
        normalizedEmail: null,
        profile: null,
      };
    }

    const normalizedEmail = normalizeCustomerAuthEmail(data.user.email);
    const linkedProfile =
      (await loadCustomerProfileByAuthUserId(data.user.id)) ??
      (await loadCustomerProfileByEmail(normalizedEmail));

    return {
      isAuthenticated: true,
      authUser: mapAuthUserToSummary(data.user),
      normalizedEmail,
      profile: linkedProfile
        ? mapCustomerProfileToSummary(linkedProfile)
        : null,
    };
  } catch (error) {
    console.error('Failed to load customer auth session.', error);

    return {
      isAuthenticated: false,
      authUser: null,
      normalizedEmail: null,
      profile: null,
    };
  }
}
