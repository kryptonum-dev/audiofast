import type { User } from '@supabase/supabase-js';

import type { Database } from '@/src/global/supabase/database.types';

import type { CustomerAuthEligibilityResult } from '../eligibility';

export type CustomerAuthEligibilityOrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'id'
  | 'order_number'
  | 'current_status'
  | 'payable_until'
  | 'customer_profile_id'
  | 'created_at'
>;

export type CustomerAuthEligibilityProfileRow = Pick<
  Database['public']['Tables']['customer_profiles']['Row'],
  'id' | 'email' | 'auth_user_id'
>;

export type CustomerAuthAuthUserSummary = {
  id: User['id'];
  email: string | null;
  email_confirmed_at: string | null;
  created_at: User['created_at'];
  last_sign_in_at: string | null;
};

export type CustomerAuthBootstrapOutcome =
  | 'skipped_invalid_email'
  | 'skipped_ineligible_email'
  | 'existing_auth_user'
  | 'created_auth_user';

export type CustomerAuthBootstrapResult = {
  normalizedEmail: string | null;
  outcome: CustomerAuthBootstrapOutcome;
  eligibility: CustomerAuthEligibilityResult;
  authUser: CustomerAuthAuthUserSummary | null;
  createdAuthUser: boolean;
};

export type CustomerAuthRequestOtpResult =
  | {
      status: 'generic_success';
      normalizedEmail: string | null;
      message: string;
      resendAvailableInSeconds: number;
      shouldTransitionToOtpEntry: true;
      didRequestOtp: boolean;
      bootstrap: CustomerAuthBootstrapResult;
    }
  | {
      status: 'error';
      normalizedEmail: string | null;
      message: string;
      code: 'otp_request_failed';
      bootstrap: CustomerAuthBootstrapResult | null;
    };

export type CustomerAuthVerifyOtpResult =
  | {
      status: 'verified';
      normalizedEmail: string;
      message: string;
      authUser: CustomerAuthAuthUserSummary;
      sessionCreated: true;
      profileLink: CustomerAuthProfileLinkResult;
    }
  | {
      status: 'invalid_code';
      normalizedEmail: string | null;
      message: string;
      code: 'invalid_code';
      authUser: null;
    }
  | {
      status: 'expired_code';
      normalizedEmail: string | null;
      message: string;
      code: 'expired_code';
      authUser: null;
    }
  | {
      status: 'error';
      normalizedEmail: string | null;
      message: string;
      code: 'otp_verification_failed';
      authUser: null;
    };

export type CustomerAuthProfileSummary = Pick<
  Database['public']['Tables']['customer_profiles']['Row'],
  'id' | 'email' | 'auth_user_id' | 'first_name' | 'last_name'
>;

export type CustomerAuthProfileLinkOutcome =
  | 'linked_profile'
  | 'already_linked_profile'
  | 'no_matching_profile'
  | 'conflicting_profile_link'
  | 'profile_link_error';

export type CustomerAuthProfileLinkResult = {
  outcome: CustomerAuthProfileLinkOutcome;
  profile: CustomerAuthProfileSummary | null;
};
