import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

import { normalizeCustomerAuthEmail } from '@/src/global/b2c/customer-auth/email';
import { resolveCustomerAccountReturnTo } from '@/src/global/b2c/customer-auth/return-to';
import { linkCustomerAuthIdentityToProfile } from '@/src/global/b2c/customer-auth/server/link-auth-profile';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';

const E2E_EMAIL_DOMAIN = '@audiofast.test';
const E2E_EMAIL_PREFIX = 'e2e+';
const E2E_SECRET_HEADER = 'x-e2e-auth-secret';

function isE2eAuthHelperEnabled() {
  return (
    process.env.E2E_AUTH_HELPER === '1' &&
    process.env.VERCEL_ENV !== 'production'
  );
}

function isAuthorizedE2eRequest(request: NextRequest) {
  const expectedSecret = process.env.E2E_AUTH_HELPER_SECRET;

  return (
    typeof expectedSecret === 'string' &&
    expectedSecret.length > 0 &&
    request.headers.get(E2E_SECRET_HEADER) === expectedSecret
  );
}

function isAllowedE2eEmail(email: string) {
  return email.startsWith(E2E_EMAIL_PREFIX) && email.endsWith(E2E_EMAIL_DOMAIN);
}

function getSafeRedirectUrl(request: NextRequest) {
  const returnTo = resolveCustomerAccountReturnTo(
    request.nextUrl.searchParams.get('returnTo'),
  );
  const host = request.headers.get('host') ?? request.nextUrl.host;
  const protocol =
    host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : request.nextUrl.protocol.replace(':', '');

  return new URL(returnTo, `${protocol}://${host}`);
}

function getVerificationType(value: unknown): EmailOtpType {
  if (
    value === 'signup' ||
    value === 'invite' ||
    value === 'magiclink' ||
    value === 'recovery' ||
    value === 'email_change' ||
    value === 'email'
  ) {
    return value;
  }

  return 'magiclink';
}

function createE2eAuthResponseClient(
  request: NextRequest,
  response: NextResponse,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase auth configuration.');
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

export async function GET(request: NextRequest) {
  if (!isE2eAuthHelperEnabled()) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  if (!isAuthorizedE2eRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const email = normalizeCustomerAuthEmail(
    request.nextUrl.searchParams.get('email') ?? '',
  );

  if (!isAllowedE2eEmail(email)) {
    return NextResponse.json(
      { error: 'E2E auth helper only accepts e2e+...@audiofast.test emails.' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

  const tokenHash = linkData.properties?.hashed_token;

  if (linkError || !tokenHash) {
    console.error('Failed to generate E2E customer auth link.', {
      email,
      error: linkError,
    });

    return NextResponse.json(
      { error: 'Failed to generate E2E customer auth link.' },
      { status: 500 },
    );
  }

  const redirectResponse = NextResponse.redirect(getSafeRedirectUrl(request));
  const supabase = createE2eAuthResponseClient(request, redirectResponse);
  const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: getVerificationType(linkData.properties?.verification_type),
  });

  if (verifyError || !authData.user?.email || !authData.session) {
    console.error('Failed to verify E2E customer auth link.', {
      email,
      error: verifyError,
    });

    return NextResponse.json(
      { error: 'Failed to verify E2E customer auth link.' },
      { status: 500 },
    );
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
  });

  if (sessionError) {
    console.error('Failed to persist E2E customer auth session.', {
      email,
      error: sessionError,
    });

    return NextResponse.json(
      { error: 'Failed to persist E2E customer auth session.' },
      { status: 500 },
    );
  }

  await linkCustomerAuthIdentityToProfile({
    authUserId: authData.user.id,
    email: authData.user.email,
  });

  return redirectResponse;
}
