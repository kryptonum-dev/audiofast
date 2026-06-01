import 'server-only';

import { createAdminClient } from '@/src/global/supabase/admin';

import { isValidCustomerAuthEmail, normalizeCustomerAuthEmail } from '../email';
import type {
  CustomerAuthProfileLinkResult,
  CustomerAuthProfileSummary,
} from './types';

type CustomerProfileRow = CustomerAuthProfileSummary;

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

async function updateCustomerProfileAuthUserLink(args: {
  profileId: string;
  authUserId: string;
}): Promise<CustomerProfileRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_profiles')
    .update({
      auth_user_id: args.authUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.profileId)
    .select('id, email, auth_user_id, first_name, last_name')
    .single();

  if (error) {
    throw error;
  }

  return data as CustomerProfileRow;
}

export async function linkCustomerAuthIdentityToProfile(args: {
  authUserId: string;
  email: string;
}): Promise<CustomerAuthProfileLinkResult> {
  const normalizedEmail = normalizeCustomerAuthEmail(args.email);

  if (!isValidCustomerAuthEmail(normalizedEmail)) {
    return {
      outcome: 'profile_link_error',
      profile: null,
    };
  }

  try {
    const profileLinkedByAuthUserId = await loadCustomerProfileByAuthUserId(
      args.authUserId,
    );

    if (profileLinkedByAuthUserId) {
      return {
        outcome: 'already_linked_profile',
        profile: mapCustomerProfileToSummary(profileLinkedByAuthUserId),
      };
    }

    const profileMatchedByEmail =
      await loadCustomerProfileByEmail(normalizedEmail);

    if (!profileMatchedByEmail) {
      return {
        outcome: 'no_matching_profile',
        profile: null,
      };
    }

    if (profileMatchedByEmail.auth_user_id === null) {
      const updatedProfile = await updateCustomerProfileAuthUserLink({
        profileId: profileMatchedByEmail.id,
        authUserId: args.authUserId,
      });

      return {
        outcome: 'linked_profile',
        profile: mapCustomerProfileToSummary(updatedProfile),
      };
    }

    if (profileMatchedByEmail.auth_user_id === args.authUserId) {
      return {
        outcome: 'already_linked_profile',
        profile: mapCustomerProfileToSummary(profileMatchedByEmail),
      };
    }

    console.warn(
      'Skipping customer auth profile link because the matched profile already belongs to another auth user.',
      {
        profileId: profileMatchedByEmail.id,
        normalizedEmail,
        existingAuthUserId: profileMatchedByEmail.auth_user_id,
        verifiedAuthUserId: args.authUserId,
      },
    );

    return {
      outcome: 'conflicting_profile_link',
      profile: mapCustomerProfileToSummary(profileMatchedByEmail),
    };
  } catch (error) {
    console.error('Failed to link customer auth identity to profile.', {
      email: normalizedEmail,
      authUserId: args.authUserId,
      error,
    });

    return {
      outcome: 'profile_link_error',
      profile: null,
    };
  }
}
