import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthServerClient } from '@/src/global/supabase/server-auth';

import { ensureCustomerAuthUserBootstrap } from './bootstrap-auth-user';
import { requestCustomerAuthOtp } from './request-otp';
import type { CustomerAuthBootstrapResult } from './types';

vi.mock('@/src/global/supabase/server-auth', () => ({
  createAuthServerClient: vi.fn(),
}));

vi.mock('./bootstrap-auth-user', () => ({
  ensureCustomerAuthUserBootstrap: vi.fn(),
}));

function createBootstrapResult(
  overrides: Partial<CustomerAuthBootstrapResult> = {},
): CustomerAuthBootstrapResult {
  return {
    normalizedEmail: 'jan@example.com',
    outcome: 'existing_auth_user',
    eligibility: {
      normalizedEmail: 'jan@example.com',
      isValidEmail: true,
      isEligible: true,
      reason: 'eligible_order_access',
      matchedOrders: [
        {
          id: 'order-1',
          orderNumber: 'AF-2026-00001',
          currentStatus: 'paid',
          payableUntil: '2026-04-25T12:00:00.000Z',
          customerProfileId: 'profile-1',
          createdAt: '2026-04-24T10:00:00.000Z',
          accessKind: 'customer_visible',
        },
      ],
      matchedProfile: {
        id: 'profile-1',
        email: 'jan@example.com',
        authUserId: null,
      },
    },
    authUser: {
      id: 'auth-user-1',
      email: 'jan@example.com',
      email_confirmed_at: '2026-04-24T11:00:00.000Z',
      created_at: '2026-04-24T11:00:00.000Z',
      last_sign_in_at: null,
    },
    createdAuthUser: false,
    ...overrides,
  };
}

function createOtpClientMock() {
  const signInWithOtpMock = vi.fn().mockResolvedValue({
    error: null,
  });

  return {
    auth: {
      signInWithOtp: signInWithOtpMock,
    },
    signInWithOtpMock,
  };
}

describe('requestCustomerAuthOtp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns generic success without requesting OTP for invalid emails', async () => {
    vi.mocked(ensureCustomerAuthUserBootstrap).mockResolvedValue(
      createBootstrapResult({
        normalizedEmail: 'not-an-email',
        outcome: 'skipped_invalid_email',
        eligibility: {
          normalizedEmail: 'not-an-email',
          isValidEmail: false,
          isEligible: false,
          reason: 'invalid_email',
          matchedOrders: [],
          matchedProfile: null,
        },
        authUser: null,
      }),
    );

    const result = await requestCustomerAuthOtp({
      email: 'not-an-email',
    });

    expect(createAuthServerClient).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'generic_success',
      normalizedEmail: 'not-an-email',
      message:
        'Jeśli znaleźliśmy zamówienia dla tego adresu, wysłaliśmy kod logowania.',
      resendAvailableInSeconds: 60,
      shouldTransitionToOtpEntry: true,
      didRequestOtp: false,
      bootstrap: createBootstrapResult({
        normalizedEmail: 'not-an-email',
        outcome: 'skipped_invalid_email',
        eligibility: {
          normalizedEmail: 'not-an-email',
          isValidEmail: false,
          isEligible: false,
          reason: 'invalid_email',
          matchedOrders: [],
          matchedProfile: null,
        },
        authUser: null,
      }),
    });
  });

  it('returns generic success without requesting OTP for ineligible emails', async () => {
    vi.mocked(ensureCustomerAuthUserBootstrap).mockResolvedValue(
      createBootstrapResult({
        outcome: 'skipped_ineligible_email',
        eligibility: {
          ...createBootstrapResult().eligibility,
          isEligible: false,
          reason: 'no_matching_orders',
          matchedOrders: [],
        },
        authUser: null,
      }),
    );

    const result = await requestCustomerAuthOtp({
      email: 'jan@example.com',
    });

    expect(createAuthServerClient).not.toHaveBeenCalled();
    expect(result.status).toBe('generic_success');
    expect(result.status === 'generic_success' ? result.didRequestOtp : null).toBe(
      false,
    );
  });

  it('requests an OTP for eligible bootstrapped emails', async () => {
    vi.mocked(ensureCustomerAuthUserBootstrap).mockResolvedValue(
      createBootstrapResult(),
    );
    const otpClientMock = createOtpClientMock();

    vi.mocked(createAuthServerClient).mockResolvedValue(otpClientMock as never);

    const result = await requestCustomerAuthOtp({
      email: 'jan@example.com',
    });

    expect(otpClientMock.signInWithOtpMock).toHaveBeenCalledWith({
      email: 'jan@example.com',
      options: {
        shouldCreateUser: false,
      },
    });
    expect(result.status).toBe('generic_success');
    expect(result.status === 'generic_success' ? result.didRequestOtp : null).toBe(
      true,
    );
  });

  it('returns a retryable error when Supabase OTP send fails', async () => {
    vi.mocked(ensureCustomerAuthUserBootstrap).mockResolvedValue(
      createBootstrapResult(),
    );
    const otpClientMock = createOtpClientMock();
    otpClientMock.signInWithOtpMock.mockResolvedValue({
      error: {
        message: 'SMTP offline',
      },
    });

    vi.mocked(createAuthServerClient).mockResolvedValue(otpClientMock as never);

    const result = await requestCustomerAuthOtp({
      email: 'jan@example.com',
    });

    expect(result).toEqual({
      status: 'error',
      normalizedEmail: 'jan@example.com',
      message: 'Nie udało się wysłać kodu logowania. Spróbuj ponownie.',
      code: 'otp_request_failed',
      bootstrap: createBootstrapResult(),
    });
  });

  it('returns a retryable error when bootstrap throws unexpectedly', async () => {
    vi.mocked(ensureCustomerAuthUserBootstrap).mockRejectedValue(
      new Error('DB unavailable'),
    );

    const result = await requestCustomerAuthOtp({
      email: ' Jan@example.com ',
    });

    expect(createAuthServerClient).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'error',
      normalizedEmail: 'jan@example.com',
      message: 'Nie udało się wysłać kodu logowania. Spróbuj ponownie.',
      code: 'otp_request_failed',
      bootstrap: null,
    });
  });
});
