import 'server-only';

import { createAuthServerClient } from '@/src/global/supabase/server-auth';

import { normalizeCustomerAuthEmail } from '../email';
import { ensureCustomerAuthUserBootstrap } from './bootstrap-auth-user';
import type { CustomerAuthRequestOtpResult } from './types';

const CUSTOMER_AUTH_GENERIC_SUCCESS_MESSAGE =
  'Jeśli znaleźliśmy zamówienia dla tego adresu, wysłaliśmy kod logowania.';
const CUSTOMER_AUTH_OTP_SEND_ERROR_MESSAGE =
  'Nie udało się wysłać kodu logowania. Spróbuj ponownie.';
const CUSTOMER_AUTH_OTP_RESEND_INTERVAL_SECONDS = 60;

type CustomerAuthOtpClient = {
  auth: {
    signInWithOtp: (args: {
      email: string;
      options: {
        shouldCreateUser: boolean;
      };
    }) => Promise<{
      error: {
        message?: string;
      } | null;
    }>;
  };
};

function createGenericSuccessResult(
  bootstrap: Awaited<ReturnType<typeof ensureCustomerAuthUserBootstrap>>,
  didRequestOtp: boolean,
): CustomerAuthRequestOtpResult {
  return {
    status: 'generic_success',
    normalizedEmail: bootstrap.normalizedEmail,
    message: CUSTOMER_AUTH_GENERIC_SUCCESS_MESSAGE,
    resendAvailableInSeconds: CUSTOMER_AUTH_OTP_RESEND_INTERVAL_SECONDS,
    shouldTransitionToOtpEntry: true,
    didRequestOtp,
    bootstrap,
  };
}

async function getCustomerAuthOtpClient(): Promise<CustomerAuthOtpClient> {
  return (await createAuthServerClient()) as unknown as CustomerAuthOtpClient;
}

export async function requestCustomerAuthOtp(args: {
  email: string;
  now?: Date;
}): Promise<CustomerAuthRequestOtpResult> {
  try {
    const bootstrap = await ensureCustomerAuthUserBootstrap({
      email: args.email,
      now: args.now,
    });

    if (
      bootstrap.outcome === 'skipped_invalid_email' ||
      bootstrap.outcome === 'skipped_ineligible_email' ||
      !bootstrap.normalizedEmail
    ) {
      return createGenericSuccessResult(bootstrap, false);
    }

    const supabase = await getCustomerAuthOtpClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: bootstrap.normalizedEmail,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      console.error('Failed to request customer auth OTP.', {
        email: bootstrap.normalizedEmail,
        error,
      });

      return {
        status: 'error',
        normalizedEmail: bootstrap.normalizedEmail,
        message: CUSTOMER_AUTH_OTP_SEND_ERROR_MESSAGE,
        code: 'otp_request_failed',
        bootstrap,
      };
    }

    return createGenericSuccessResult(bootstrap, true);
  } catch (error) {
    console.error('Unexpected customer auth OTP request failure.', error);

    return {
      status: 'error',
      normalizedEmail: normalizeCustomerAuthEmail(args.email) || null,
      message: CUSTOMER_AUTH_OTP_SEND_ERROR_MESSAGE,
      code: 'otp_request_failed',
      bootstrap: null,
    };
  }
}
