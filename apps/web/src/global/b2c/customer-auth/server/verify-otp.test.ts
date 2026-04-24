import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthServerClient } from '@/src/global/supabase/server-auth';

import { linkCustomerAuthIdentityToProfile } from './link-auth-profile';
import { verifyCustomerAuthOtp } from './verify-otp';

vi.mock('@/src/global/supabase/server-auth', () => ({
  createAuthServerClient: vi.fn(),
}));

vi.mock('./link-auth-profile', () => ({
  linkCustomerAuthIdentityToProfile: vi.fn(),
}));

function createVerifiedAuthUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'auth-user-1',
    email: 'jan@example.com',
    email_confirmed_at: '2026-04-24T11:00:00.000Z',
    created_at: '2026-04-24T11:00:00.000Z',
    last_sign_in_at: '2026-04-24T11:15:00.000Z',
    ...overrides,
  };
}

function createVerifyOtpClientMock() {
  const verifyOtpMock = vi.fn().mockResolvedValue({
    data: {
      user: createVerifiedAuthUser(),
      session: {
        user: createVerifiedAuthUser(),
      },
    },
    error: null,
  });

  return {
    auth: {
      verifyOtp: verifyOtpMock,
    },
    verifyOtpMock,
  };
}

describe('verifyCustomerAuthOtp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(linkCustomerAuthIdentityToProfile).mockResolvedValue({
      outcome: 'linked_profile',
      profile: {
        id: 'profile-1',
        email: 'jan@example.com',
        auth_user_id: 'auth-user-1',
        first_name: 'Jan',
        last_name: 'Kowalski',
      },
    });
  });

  it('returns invalid_code before touching Supabase for malformed OTP input', async () => {
    const result = await verifyCustomerAuthOtp({
      email: 'jan@example.com',
      code: '12',
    });

    expect(createAuthServerClient).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'invalid_code',
      normalizedEmail: 'jan@example.com',
      message: 'Kod jest nieprawidłowy. Sprawdź go i spróbuj ponownie.',
      code: 'invalid_code',
      authUser: null,
    });
  });

  it('returns a generic operational error for malformed email input', async () => {
    const result = await verifyCustomerAuthOtp({
      email: 'not-an-email',
      code: '123456',
    });

    expect(createAuthServerClient).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'error',
      normalizedEmail: 'not-an-email',
      message: 'Nie udało się potwierdzić kodu logowania. Spróbuj ponownie.',
      code: 'otp_verification_failed',
      authUser: null,
    });
  });

  it('verifies the OTP and creates the real authenticated session', async () => {
    const verifyOtpClientMock = createVerifyOtpClientMock();

    vi.mocked(createAuthServerClient).mockResolvedValue(
      verifyOtpClientMock as never,
    );

    const result = await verifyCustomerAuthOtp({
      email: ' Jan@example.com ',
      code: '123 456',
    });

    expect(verifyOtpClientMock.verifyOtpMock).toHaveBeenCalledWith({
      email: 'jan@example.com',
      token: '123456',
      type: 'email',
    });
    expect(result).toEqual({
      status: 'verified',
      normalizedEmail: 'jan@example.com',
      message: 'Zalogowano pomyślnie.',
      authUser: {
        id: 'auth-user-1',
        email: 'jan@example.com',
        email_confirmed_at: '2026-04-24T11:00:00.000Z',
        created_at: '2026-04-24T11:00:00.000Z',
        last_sign_in_at: '2026-04-24T11:15:00.000Z',
      },
      sessionCreated: true,
      profileLink: {
        outcome: 'linked_profile',
        profile: {
          id: 'profile-1',
          email: 'jan@example.com',
          auth_user_id: 'auth-user-1',
          first_name: 'Jan',
          last_name: 'Kowalski',
        },
      },
    });
  });

  it('maps otp_expired-style responses to expired_code', async () => {
    const verifyOtpClientMock = createVerifyOtpClientMock();
    verifyOtpClientMock.verifyOtpMock.mockResolvedValue({
      data: {
        user: null,
        session: null,
      },
      error: {
        code: 'otp_expired',
        message: 'Token has expired or is invalid',
        name: 'AuthApiError',
        status: 401,
      },
    });

    vi.mocked(createAuthServerClient).mockResolvedValue(
      verifyOtpClientMock as never,
    );

    const result = await verifyCustomerAuthOtp({
      email: 'jan@example.com',
      code: '123456',
    });

    expect(result).toEqual({
      status: 'expired_code',
      normalizedEmail: 'jan@example.com',
      message: 'Kod wygasł. Poproś o nowy kod logowania.',
      code: 'expired_code',
      authUser: null,
    });
  });

  it('maps invalid-token responses to invalid_code', async () => {
    const verifyOtpClientMock = createVerifyOtpClientMock();
    verifyOtpClientMock.verifyOtpMock.mockResolvedValue({
      data: {
        user: null,
        session: null,
      },
      error: {
        message: 'Token has expired or is invalid',
        name: 'ValidationError',
        status: 400,
      },
    });

    vi.mocked(createAuthServerClient).mockResolvedValue(
      verifyOtpClientMock as never,
    );

    const result = await verifyCustomerAuthOtp({
      email: 'jan@example.com',
      code: '654321',
    });

    expect(result).toEqual({
      status: 'invalid_code',
      normalizedEmail: 'jan@example.com',
      message: 'Kod jest nieprawidłowy. Sprawdź go i spróbuj ponownie.',
      code: 'invalid_code',
      authUser: null,
    });
  });

  it('returns a generic operational error for unexpected verification failures', async () => {
    const verifyOtpClientMock = createVerifyOtpClientMock();
    verifyOtpClientMock.verifyOtpMock.mockResolvedValue({
      data: {
        user: null,
        session: null,
      },
      error: {
        message: 'Provider unavailable',
        name: 'AuthApiError',
        status: 500,
      },
    });

    vi.mocked(createAuthServerClient).mockResolvedValue(
      verifyOtpClientMock as never,
    );

    const result = await verifyCustomerAuthOtp({
      email: 'jan@example.com',
      code: '123456',
    });

    expect(result).toEqual({
      status: 'error',
      normalizedEmail: 'jan@example.com',
      message: 'Nie udało się potwierdzić kodu logowania. Spróbuj ponownie.',
      code: 'otp_verification_failed',
      authUser: null,
    });
  });
});
