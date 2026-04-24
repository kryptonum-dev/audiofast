import 'server-only';

import type { User } from '@supabase/supabase-js';

import { createAuthServerClient } from '@/src/global/supabase/server-auth';

import { isValidCustomerAuthEmail, normalizeCustomerAuthEmail } from '../email';
import { linkCustomerAuthIdentityToProfile } from './link-auth-profile';
import type {
  CustomerAuthAuthUserSummary,
  CustomerAuthVerifyOtpResult,
} from './types';

const CUSTOMER_AUTH_VERIFY_SUCCESS_MESSAGE = 'Zalogowano pomyślnie.';
const CUSTOMER_AUTH_INVALID_CODE_MESSAGE =
  'Kod jest nieprawidłowy. Sprawdź go i spróbuj ponownie.';
const CUSTOMER_AUTH_EXPIRED_CODE_MESSAGE =
  'Kod wygasł. Poproś o nowy kod logowania.';
const CUSTOMER_AUTH_VERIFY_ERROR_MESSAGE =
  'Nie udało się potwierdzić kodu logowania. Spróbuj ponownie.';

type CustomerAuthVerifyOtpError = {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
} | null;

type CustomerAuthVerifyOtpResponse = {
  data: {
    user?: User | null;
    session?: {
      user?: User | null;
    } | null;
  };
  error: CustomerAuthVerifyOtpError;
};

type CustomerAuthVerifyOtpClient = {
  auth: {
    verifyOtp: (args: {
      email: string;
      token: string;
      type: 'email';
    }) => Promise<CustomerAuthVerifyOtpResponse>;
  };
};

function normalizeCustomerAuthOtpCode(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

function isValidCustomerAuthOtpCode(value: string): boolean {
  return /^\d{6}$/.test(normalizeCustomerAuthOtpCode(value));
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

function extractVerifiedAuthUser(
  response: CustomerAuthVerifyOtpResponse['data'],
): User | null {
  if (response.user) {
    return response.user;
  }

  return response.session?.user ?? null;
}

function classifyVerifyOtpError(
  error: CustomerAuthVerifyOtpError,
): 'expired_code' | 'invalid_code' | 'error' {
  const message = error?.message?.toLowerCase() ?? '';
  const code = error?.code?.toLowerCase() ?? '';

  if (code === 'otp_expired' || message.includes('otp_expired')) {
    return 'expired_code';
  }

  if (
    message.includes('invalid') ||
    message.includes('not valid') ||
    code === 'validation_failed'
  ) {
    return 'invalid_code';
  }

  if (message.includes('expired')) {
    return 'expired_code';
  }

  return 'error';
}

async function getCustomerAuthVerifyOtpClient(): Promise<CustomerAuthVerifyOtpClient> {
  return (await createAuthServerClient()) as unknown as CustomerAuthVerifyOtpClient;
}

export async function verifyCustomerAuthOtp(args: {
  email: string;
  code: string;
}): Promise<CustomerAuthVerifyOtpResult> {
  const normalizedEmail = normalizeCustomerAuthEmail(args.email);
  const normalizedCode = normalizeCustomerAuthOtpCode(args.code);

  if (!isValidCustomerAuthEmail(normalizedEmail)) {
    return {
      status: 'error',
      normalizedEmail: normalizedEmail || null,
      message: CUSTOMER_AUTH_VERIFY_ERROR_MESSAGE,
      code: 'otp_verification_failed',
      authUser: null,
    };
  }

  if (!isValidCustomerAuthOtpCode(normalizedCode)) {
    return {
      status: 'invalid_code',
      normalizedEmail,
      message: CUSTOMER_AUTH_INVALID_CODE_MESSAGE,
      code: 'invalid_code',
      authUser: null,
    };
  }

  try {
    const supabase = await getCustomerAuthVerifyOtpClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedCode,
      type: 'email',
    });

    if (error) {
      const resultType = classifyVerifyOtpError(error);

      if (resultType === 'expired_code') {
        return {
          status: 'expired_code',
          normalizedEmail,
          message: CUSTOMER_AUTH_EXPIRED_CODE_MESSAGE,
          code: 'expired_code',
          authUser: null,
        };
      }

      if (resultType === 'invalid_code') {
        return {
          status: 'invalid_code',
          normalizedEmail,
          message: CUSTOMER_AUTH_INVALID_CODE_MESSAGE,
          code: 'invalid_code',
          authUser: null,
        };
      }

      console.error('Failed to verify customer auth OTP.', {
        email: normalizedEmail,
        error,
      });

      return {
        status: 'error',
        normalizedEmail,
        message: CUSTOMER_AUTH_VERIFY_ERROR_MESSAGE,
        code: 'otp_verification_failed',
        authUser: null,
      };
    }

    const verifiedUser = extractVerifiedAuthUser(data);

    if (!verifiedUser) {
      console.error(
        'Customer auth OTP verification succeeded without a user.',
        {
          email: normalizedEmail,
        },
      );

      return {
        status: 'error',
        normalizedEmail,
        message: CUSTOMER_AUTH_VERIFY_ERROR_MESSAGE,
        code: 'otp_verification_failed',
        authUser: null,
      };
    }

    return {
      status: 'verified',
      normalizedEmail,
      message: CUSTOMER_AUTH_VERIFY_SUCCESS_MESSAGE,
      authUser: mapAuthUserToSummary(verifiedUser),
      sessionCreated: true,
      profileLink: await linkCustomerAuthIdentityToProfile({
        authUserId: verifiedUser.id,
        email: normalizedEmail,
      }),
    };
  } catch (error) {
    console.error('Unexpected customer auth OTP verification failure.', error);

    return {
      status: 'error',
      normalizedEmail,
      message: CUSTOMER_AUTH_VERIFY_ERROR_MESSAGE,
      code: 'otp_verification_failed',
      authUser: null,
    };
  }
}
