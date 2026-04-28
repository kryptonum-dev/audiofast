import type { User } from '@supabase/supabase-js';
import { unstable_rethrow } from 'next/navigation';

import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';
import { createAuthServerClient } from '@/src/global/supabase/server-auth';

import {
  canPrefillOrderFormFromProfile,
  mapCheckoutCustomerProfileRowToDefaults,
  shouldLockOrderFormEmail,
} from '../profile';
import type { CheckoutSessionContext } from '../types';
import type { CheckoutAuthContext } from './types';

type CustomerProfileRow =
  Database['public']['Tables']['customer_profiles']['Row'];

function createGuestCheckoutSessionContext(): CheckoutSessionContext {
  return {
    isAuthenticated: false,
    authUserId: null,
    authenticatedEmail: null,
    customerProfileId: null,
  };
}

async function lookupCustomerProfile(
  user: User,
): Promise<CustomerProfileRow | null> {
  const supabase = createAdminClient();

  const { data: profileByAuthId, error: authLookupError } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (authLookupError) {
    throw authLookupError;
  }

  if (profileByAuthId) {
    return profileByAuthId;
  }

  if (!user.email) {
    return null;
  }

  const { data: profileByEmail, error: emailLookupError } = await supabase
    .from('customer_profiles')
    .select('*')
    .ilike('email', user.email)
    .maybeSingle();

  if (emailLookupError) {
    throw emailLookupError;
  }

  return profileByEmail;
}

export async function loadCheckoutAuthContext(): Promise<CheckoutAuthContext> {
  try {
    const supabase = await createAuthServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return {
        sessionContext: createGuestCheckoutSessionContext(),
        customerProfile: null,
        canPrefillFromProfile: false,
        isEmailLocked: false,
      };
    }

    const profileRow = await lookupCustomerProfile(data.user);
    const customerProfile = profileRow
      ? mapCheckoutCustomerProfileRowToDefaults(profileRow)
      : null;
    const sessionContext: CheckoutSessionContext = {
      isAuthenticated: true,
      authUserId: data.user.id,
      authenticatedEmail: data.user.email?.toLowerCase() ?? null,
      customerProfileId: profileRow?.id ?? null,
    };

    return {
      sessionContext,
      customerProfile,
      canPrefillFromProfile: canPrefillOrderFormFromProfile(
        sessionContext,
        customerProfile,
      ),
      isEmailLocked: shouldLockOrderFormEmail(sessionContext),
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error('Failed to load checkout auth context.', error);

    return {
      sessionContext: createGuestCheckoutSessionContext(),
      customerProfile: null,
      canPrefillFromProfile: false,
      isEmailLocked: false,
    };
  }
}
