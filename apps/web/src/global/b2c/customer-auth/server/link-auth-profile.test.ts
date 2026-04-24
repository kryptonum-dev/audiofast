import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import { linkCustomerAuthIdentityToProfile } from './link-auth-profile';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

function createCustomerProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    email: 'jan@example.com',
    auth_user_id: null,
    first_name: 'Jan',
    last_name: 'Kowalski',
    ...overrides,
  };
}

function createAdminClientMock(args: {
  authLookupResults?: Array<{ data: unknown; error: unknown }>;
  emailLookupResults?: Array<{ data: unknown; error: unknown }>;
  updateResult?: { data: unknown; error: unknown };
}) {
  const authLookupQueue = [...(args.authLookupResults ?? [])];
  const emailLookupQueue = [...(args.emailLookupResults ?? [])];
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(
          args.updateResult ?? {
            data: createCustomerProfile({ auth_user_id: 'auth-user-1' }),
            error: null,
          },
        ),
      }),
    }),
  });

  const selectMock = vi.fn(() => ({
    eq: vi.fn((_column: string, value: string) => ({
      maybeSingle: vi
        .fn()
        .mockResolvedValue(
          value === 'auth-user-1'
            ? (authLookupQueue.shift() ?? { data: null, error: null })
            : { data: null, error: null },
        ),
    })),
    ilike: vi.fn(() => ({
      maybeSingle: vi
        .fn()
        .mockResolvedValue(
          emailLookupQueue.shift() ?? { data: null, error: null },
        ),
    })),
  }));

  return {
    from: vi.fn(() => ({
      select: selectMock,
      update: updateMock,
    })),
    selectMock,
    updateMock,
  };
}

describe('linkCustomerAuthIdentityToProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns already_linked_profile when the auth user is already linked', async () => {
    const adminClientMock = createAdminClientMock({
      authLookupResults: [
        {
          data: createCustomerProfile({ auth_user_id: 'auth-user-1' }),
          error: null,
        },
      ],
    });

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    const result = await linkCustomerAuthIdentityToProfile({
      authUserId: 'auth-user-1',
      email: 'jan@example.com',
    });

    expect(result).toEqual({
      outcome: 'already_linked_profile',
      profile: createCustomerProfile({ auth_user_id: 'auth-user-1' }),
    });
  });

  it('links the email-matched profile when auth_user_id is currently null', async () => {
    const adminClientMock = createAdminClientMock({
      authLookupResults: [{ data: null, error: null }],
      emailLookupResults: [
        {
          data: createCustomerProfile(),
          error: null,
        },
      ],
      updateResult: {
        data: createCustomerProfile({ auth_user_id: 'auth-user-1' }),
        error: null,
      },
    });

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    const result = await linkCustomerAuthIdentityToProfile({
      authUserId: 'auth-user-1',
      email: 'jan@example.com',
    });

    expect(result).toEqual({
      outcome: 'linked_profile',
      profile: createCustomerProfile({ auth_user_id: 'auth-user-1' }),
    });
  });

  it('returns no_matching_profile when the verified email has no customer profile yet', async () => {
    const adminClientMock = createAdminClientMock({
      authLookupResults: [{ data: null, error: null }],
      emailLookupResults: [{ data: null, error: null }],
    });

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    const result = await linkCustomerAuthIdentityToProfile({
      authUserId: 'auth-user-1',
      email: 'jan@example.com',
    });

    expect(result).toEqual({
      outcome: 'no_matching_profile',
      profile: null,
    });
  });

  it('returns conflicting_profile_link without overwriting another auth owner', async () => {
    const adminClientMock = createAdminClientMock({
      authLookupResults: [{ data: null, error: null }],
      emailLookupResults: [
        {
          data: createCustomerProfile({ auth_user_id: 'other-auth-user' }),
          error: null,
        },
      ],
    });

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    const result = await linkCustomerAuthIdentityToProfile({
      authUserId: 'auth-user-1',
      email: 'jan@example.com',
    });

    expect(result).toEqual({
      outcome: 'conflicting_profile_link',
      profile: createCustomerProfile({ auth_user_id: 'other-auth-user' }),
    });
  });
});
