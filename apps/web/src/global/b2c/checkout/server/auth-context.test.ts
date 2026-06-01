import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';
import { createAuthServerClient } from '@/src/global/supabase/server-auth';

import { loadCheckoutAuthContext } from './auth-context';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/src/global/supabase/server-auth', () => ({
  createAuthServerClient: vi.fn(),
}));

function createAuthServerClientMock(args: {
  user: {
    id: string;
    email: string | null;
  } | null;
  error?: unknown;
}) {
  const getUserMock = vi.fn().mockResolvedValue({
    data: {
      user: args.user,
    },
    error: args.error ?? null,
  });

  return {
    auth: {
      getUser: getUserMock,
    },
    getUserMock,
  };
}

function createAdminClientMock(
  lookupResults: Array<{ data: unknown; error: unknown }>,
) {
  const maybeSingleMock = vi.fn();
  lookupResults.forEach((result) => {
    maybeSingleMock.mockResolvedValueOnce(result);
  });

  const eqMock = vi.fn(() => ({
    maybeSingle: maybeSingleMock,
  }));
  const ilikeMock = vi.fn(() => ({
    maybeSingle: maybeSingleMock,
  }));
  const selectMock = vi.fn(() => ({
    eq: eqMock,
    ilike: ilikeMock,
  }));
  const fromMock = vi.fn(() => ({
    select: selectMock,
  }));

  return {
    from: fromMock,
    selectMock,
    eqMock,
    ilikeMock,
    maybeSingleMock,
  };
}

function createCustomerProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    email: 'jan@example.com',
    auth_user_id: 'auth-user-1',
    first_name: 'Jan',
    last_name: 'Kowalski',
    phone: '123123123',
    default_shipping_address: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123123123',
      streetName: 'Testowa',
      buildingNumber: '1',
      apartmentNumber: null,
      postalCode: '00-001',
      city: 'Warszawa',
      country: 'PL',
    },
    default_invoice_data: {
      recipientType: 'company',
      companyName: 'Audiofast Sp. z o.o.',
      taxId: '1234567890',
      invoiceAddress: {
        streetName: 'Fakturowa',
        buildingNumber: '2',
        apartmentNumber: null,
        postalCode: '00-002',
        city: 'Warszawa',
        country: 'PL',
      },
    },
    ...overrides,
  };
}

describe('loadCheckoutAuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a guest checkout context when no authenticated user exists', async () => {
    vi.mocked(createAuthServerClient).mockResolvedValue(
      createAuthServerClientMock({
        user: null,
      }) as never,
    );

    const result = await loadCheckoutAuthContext();

    expect(createAdminClient).not.toHaveBeenCalled();
    expect(result).toEqual({
      sessionContext: {
        isAuthenticated: false,
        authUserId: null,
        authenticatedEmail: null,
        customerProfileId: null,
      },
      customerProfile: null,
      canPrefillFromProfile: false,
      isEmailLocked: false,
    });
  });

  it('loads the linked profile by auth_user_id and enables checkout prefill', async () => {
    vi.mocked(createAuthServerClient).mockResolvedValue(
      createAuthServerClientMock({
        user: {
          id: 'auth-user-1',
          email: 'Jan@example.com',
        },
      }) as never,
    );
    const adminClientMock = createAdminClientMock([
      {
        data: createCustomerProfileRow(),
        error: null,
      },
    ]);

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    const result = await loadCheckoutAuthContext();

    expect(adminClientMock.eqMock).toHaveBeenCalledWith(
      'auth_user_id',
      'auth-user-1',
    );
    expect(adminClientMock.ilikeMock).not.toHaveBeenCalled();
    expect(result.sessionContext).toEqual({
      isAuthenticated: true,
      authUserId: 'auth-user-1',
      authenticatedEmail: 'jan@example.com',
      customerProfileId: 'profile-1',
    });
    expect(result.isEmailLocked).toBe(true);
    expect(result.canPrefillFromProfile).toBe(true);
    expect(result.customerProfile).toEqual({
      email: 'jan@example.com',
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123123123',
      defaultShippingAddress: {
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '123123123',
        streetName: 'Testowa',
        buildingNumber: '1',
        apartmentNumber: null,
        postalCode: '00-001',
        city: 'Warszawa',
        country: 'PL',
      },
      defaultInvoiceData: {
        recipientType: 'company',
        companyName: 'Audiofast Sp. z o.o.',
        taxId: '1234567890',
        invoiceAddress: {
          streetName: 'Fakturowa',
          buildingNumber: '2',
          apartmentNumber: null,
          postalCode: '00-002',
          city: 'Warszawa',
          country: 'PL',
        },
      },
    });
  });

  it('falls back to profile lookup by email when auth_user_id is not linked yet', async () => {
    vi.mocked(createAuthServerClient).mockResolvedValue(
      createAuthServerClientMock({
        user: {
          id: 'auth-user-2',
          email: 'jan@example.com',
        },
      }) as never,
    );
    const adminClientMock = createAdminClientMock([
      {
        data: null,
        error: null,
      },
      {
        data: createCustomerProfileRow({
          auth_user_id: null,
        }),
        error: null,
      },
    ]);

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    const result = await loadCheckoutAuthContext();

    expect(adminClientMock.eqMock).toHaveBeenCalledWith(
      'auth_user_id',
      'auth-user-2',
    );
    expect(adminClientMock.ilikeMock).toHaveBeenCalledWith(
      'email',
      'jan@example.com',
    );
    expect(result.sessionContext.customerProfileId).toBe('profile-1');
    expect(result.canPrefillFromProfile).toBe(true);
    expect(result.isEmailLocked).toBe(true);
  });
});
