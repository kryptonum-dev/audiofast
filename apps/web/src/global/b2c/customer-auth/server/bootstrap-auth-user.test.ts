import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';
import type { CustomerAuthEligibilityResult } from '../eligibility';

import {
  CustomerAuthBootstrapError,
  ensureCustomerAuthUserBootstrap,
} from './bootstrap-auth-user';
import { resolveCustomerAuthEligibility } from './eligibility';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('./eligibility', () => ({
  resolveCustomerAuthEligibility: vi.fn(),
}));

function createAdminClientMock(args: {
  listUsersResults: Array<{
    data: {
      users?: unknown[];
    };
    error: {
      message?: string;
    } | null;
  }>;
  createUserResult?: {
    data: {
      user: unknown;
    };
    error: {
      message?: string;
    } | null;
  };
}) {
  const listUsersMock = vi.fn();
  args.listUsersResults.forEach((result) => {
    listUsersMock.mockResolvedValueOnce(result);
  });
  const createUserMock = vi
    .fn()
    .mockResolvedValue(
      args.createUserResult ?? {
        data: {
          user: null,
        },
        error: null,
      },
    );

  return {
    auth: {
      admin: {
        listUsers: listUsersMock,
        createUser: createUserMock,
      },
    },
    listUsersMock,
    createUserMock,
  };
}

function createEligibilityResult(
  overrides: Record<string, unknown> = {},
): CustomerAuthEligibilityResult {
  return {
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
    ...overrides,
  };
}

function createAuthUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'auth-user-1',
    email: 'jan@example.com',
    email_confirmed_at: '2026-04-24T11:00:00.000Z',
    created_at: '2026-04-24T11:00:00.000Z',
    last_sign_in_at: null,
    ...overrides,
  };
}

describe('ensureCustomerAuthUserBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips invalid emails before touching auth bootstrap', async () => {
    vi.mocked(resolveCustomerAuthEligibility).mockResolvedValue(
      createEligibilityResult({
        normalizedEmail: 'not-an-email',
        isValidEmail: false,
        isEligible: false,
        reason: 'invalid_email',
        matchedOrders: [],
        matchedProfile: null,
      }),
    );

    const result = await ensureCustomerAuthUserBootstrap({
      email: 'not-an-email',
    });

    expect(createAdminClient).not.toHaveBeenCalled();
    expect(result).toEqual({
      normalizedEmail: 'not-an-email',
      outcome: 'skipped_invalid_email',
      eligibility: createEligibilityResult({
        normalizedEmail: 'not-an-email',
        isValidEmail: false,
        isEligible: false,
        reason: 'invalid_email',
        matchedOrders: [],
        matchedProfile: null,
      }),
      authUser: null,
      createdAuthUser: false,
    });
  });

  it('skips ineligible emails without touching auth bootstrap', async () => {
    vi.mocked(resolveCustomerAuthEligibility).mockResolvedValue(
      createEligibilityResult({
        isEligible: false,
        reason: 'no_matching_orders',
        matchedOrders: [],
      }),
    );

    const result = await ensureCustomerAuthUserBootstrap({
      email: 'jan@example.com',
    });

    expect(createAdminClient).not.toHaveBeenCalled();
    expect(result.outcome).toBe('skipped_ineligible_email');
    expect(result.createdAuthUser).toBe(false);
    expect(result.authUser).toBeNull();
  });

  it('returns the existing auth user when one already exists for an eligible email', async () => {
    vi.mocked(resolveCustomerAuthEligibility).mockResolvedValue(
      createEligibilityResult(),
    );
    const adminClientMock = createAdminClientMock({
      listUsersResults: [
        {
          data: {
            users: [createAuthUser()],
          },
          error: null,
        },
      ],
    });

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    const result = await ensureCustomerAuthUserBootstrap({
      email: 'jan@example.com',
    });

    expect(adminClientMock.createUserMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      normalizedEmail: 'jan@example.com',
      outcome: 'existing_auth_user',
      eligibility: createEligibilityResult(),
      authUser: {
        id: 'auth-user-1',
        email: 'jan@example.com',
        email_confirmed_at: '2026-04-24T11:00:00.000Z',
        created_at: '2026-04-24T11:00:00.000Z',
        last_sign_in_at: null,
      },
      createdAuthUser: false,
    });
  });

  it('creates a verified passwordless auth user for an eligible email when one does not exist yet', async () => {
    vi.mocked(resolveCustomerAuthEligibility).mockResolvedValue(
      createEligibilityResult(),
    );
    const adminClientMock = createAdminClientMock({
      listUsersResults: [
        {
          data: {
            users: [],
          },
          error: null,
        },
      ],
      createUserResult: {
        data: {
          user: createAuthUser(),
        },
        error: null,
      },
    });

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    const result = await ensureCustomerAuthUserBootstrap({
      email: 'jan@example.com',
    });

    expect(adminClientMock.createUserMock).toHaveBeenCalledWith({
      email: 'jan@example.com',
      email_confirm: true,
    });
    expect(result.outcome).toBe('created_auth_user');
    expect(result.createdAuthUser).toBe(true);
    expect(result.authUser?.id).toBe('auth-user-1');
  });

  it('recovers from duplicate create races by reloading the newly created auth user', async () => {
    vi.mocked(resolveCustomerAuthEligibility).mockResolvedValue(
      createEligibilityResult(),
    );
    const adminClientMock = createAdminClientMock({
      listUsersResults: [
        {
          data: {
            users: [],
          },
          error: null,
        },
        {
          data: {
            users: [createAuthUser()],
          },
          error: null,
        },
      ],
      createUserResult: {
        data: {
          user: null,
        },
        error: {
          message: 'User already registered',
        },
      },
    });

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    const result = await ensureCustomerAuthUserBootstrap({
      email: 'jan@example.com',
    });

    expect(adminClientMock.createUserMock).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('existing_auth_user');
    expect(result.createdAuthUser).toBe(false);
    expect(result.authUser?.id).toBe('auth-user-1');
  });

  it('throws a typed bootstrap error when auth-user creation fails for another reason', async () => {
    vi.mocked(resolveCustomerAuthEligibility).mockResolvedValue(
      createEligibilityResult(),
    );
    const adminClientMock = createAdminClientMock({
      listUsersResults: [
        {
          data: {
            users: [],
          },
          error: null,
        },
      ],
      createUserResult: {
        data: {
          user: null,
        },
        error: {
          message: 'Provider unavailable',
        },
      },
    });

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    await expect(
      ensureCustomerAuthUserBootstrap({
        email: 'jan@example.com',
      }),
    ).rejects.toBeInstanceOf(CustomerAuthBootstrapError);
  });
});
