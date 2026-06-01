import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import {
  CUSTOMER_ACCOUNT_PROFILE_SELECT,
  loadCustomerAccountProfileForPanel,
  mapCustomerAccountProfileRow,
  updateCustomerAccountProfile,
  validateCustomerAccountProfileInput,
} from './customer-account-profile';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

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
    created_at: '2026-04-01T08:00:00.000Z',
    updated_at: '2026-04-28T08:00:00.000Z',
    ...overrides,
  };
}

function setupSupabaseMock(
  lookupResults: Array<{ data: unknown; error: unknown }>,
  updateResult?: { data: unknown; error: unknown },
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
  const updateSingleMock = vi.fn().mockResolvedValue(
    updateResult ?? {
      data: createCustomerProfileRow(),
      error: null,
    },
  );
  const updateSelectMock = vi.fn(() => ({
    single: updateSingleMock,
  }));
  const updateEqMock = vi.fn(() => ({
    select: updateSelectMock,
  }));
  const updateMock = vi.fn(() => ({
    eq: updateEqMock,
  }));
  const fromMock = vi.fn(() => ({
    select: selectMock,
    update: updateMock,
  }));

  vi.mocked(createAdminClient).mockReturnValue({
    from: fromMock,
  } as never);

  return {
    eqMock,
    fromMock,
    ilikeMock,
    selectMock,
    updateEqMock,
    updateMock,
  };
}

describe('mapCustomerAccountProfileRow', () => {
  it('maps reusable customer profile defaults for the account details view', () => {
    expect(mapCustomerAccountProfileRow(createCustomerProfileRow())).toEqual({
      id: 'profile-1',
      email: 'jan@example.com',
      authUserId: 'auth-user-1',
      contact: {
        email: 'jan@example.com',
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '123123123',
      },
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
      hasUsableCheckoutDefaults: true,
      createdAt: '2026-04-01T08:00:00.000Z',
      updatedAt: '2026-04-28T08:00:00.000Z',
    });
  });

  it('keeps identity data available when stored checkout defaults are unusable', () => {
    expect(
      mapCustomerAccountProfileRow(
        createCustomerProfileRow({
          default_invoice_data: null,
          default_shipping_address: {},
          phone: null,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        contact: {
          email: 'jan@example.com',
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: null,
        },
        defaultInvoiceData: null,
        defaultShippingAddress: null,
        hasUsableCheckoutDefaults: false,
      }),
    );
  });
});

describe('loadCustomerAccountProfileForPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the account profile by auth user id first', async () => {
    const mocks = setupSupabaseMock([
      {
        data: createCustomerProfileRow(),
        error: null,
      },
    ]);

    const result = await loadCustomerAccountProfileForPanel({
      authUserId: 'auth-user-1',
      normalizedEmail: 'jan@example.com',
    });

    expect(mocks.fromMock).toHaveBeenCalledWith('customer_profiles');
    expect(mocks.selectMock).toHaveBeenCalledWith(
      CUSTOMER_ACCOUNT_PROFILE_SELECT,
    );
    expect(mocks.eqMock).toHaveBeenCalledWith('auth_user_id', 'auth-user-1');
    expect(mocks.ilikeMock).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'loaded',
        profile: expect.objectContaining({
          id: 'profile-1',
          email: 'jan@example.com',
          hasUsableCheckoutDefaults: true,
        }),
      }),
    );
  });

  it('falls back to normalized email when no profile is linked to the auth user', async () => {
    const mocks = setupSupabaseMock([
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

    const result = await loadCustomerAccountProfileForPanel({
      authUserId: 'auth-user-2',
      normalizedEmail: 'jan@example.com',
    });

    expect(mocks.eqMock).toHaveBeenCalledWith('auth_user_id', 'auth-user-2');
    expect(mocks.ilikeMock).toHaveBeenCalledWith('email', 'jan@example.com');
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'loaded',
        profile: expect.objectContaining({
          authUserId: null,
          id: 'profile-1',
        }),
      }),
    );
  });

  it('returns not_found when no matching profile exists', async () => {
    const mocks = setupSupabaseMock([
      {
        data: null,
        error: null,
      },
      {
        data: null,
        error: null,
      },
    ]);

    await expect(
      loadCustomerAccountProfileForPanel({
        authUserId: 'auth-user-2',
        normalizedEmail: 'jan@example.com',
      }),
    ).resolves.toEqual({
      kind: 'not_found',
    });
    expect(mocks.ilikeMock).toHaveBeenCalledWith('email', 'jan@example.com');
  });

  it('throws Supabase lookup errors so route-level error handling can decide the UI state', async () => {
    const error = new Error('database unavailable');
    setupSupabaseMock([
      {
        data: null,
        error,
      },
    ]);

    await expect(
      loadCustomerAccountProfileForPanel({
        authUserId: 'auth-user-1',
        normalizedEmail: 'jan@example.com',
      }),
    ).rejects.toThrow(error);
  });
});

describe('validateCustomerAccountProfileInput', () => {
  it('validates and normalizes reusable customer account data without checkout consents', () => {
    const result = validateCustomerAccountProfileInput({
      authUserId: 'auth-user-1',
      customerProfileId: 'profile-1',
      normalizedEmail: 'jan@example.com',
      input: {
        contact: {
          email: 'Jan@example.com',
          firstName: ' Jan ',
          lastName: ' Kowalski ',
          phone: '+48 123 123 123',
        },
        shippingAddress: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123-123-123',
          streetName: ' Testowa ',
          buildingNumber: ' 1 ',
          apartmentNumber: '',
          postalCode: '00001',
          city: ' Warszawa ',
          country: 'PL',
        },
        invoice: {
          recipientType: 'company',
          companyName: ' Audiofast ',
          taxId: '123-456-78-90',
          invoiceAddress: {
            streetName: ' Firmowa ',
            buildingNumber: ' 2 ',
            apartmentNumber: null,
            postalCode: '00002',
            city: ' Warszawa ',
            country: 'PL',
          },
        },
      },
    });

    expect(result).toEqual({
      isValid: true,
      value: {
        contact: {
          email: 'jan@example.com',
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123123123',
        },
        shippingAddress: {
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
        invoice: {
          recipientType: 'company',
          companyName: 'Audiofast',
          taxId: '1234567890',
          invoiceAddress: {
            streetName: 'Firmowa',
            buildingNumber: '2',
            apartmentNumber: null,
            postalCode: '00-002',
            city: 'Warszawa',
            country: 'PL',
          },
        },
      },
      errors: {
        formErrors: [],
      },
    });
  });

  it('rejects email changes for the authenticated account identity', () => {
    const result = validateCustomerAccountProfileInput({
      authUserId: 'auth-user-1',
      customerProfileId: 'profile-1',
      normalizedEmail: 'jan@example.com',
      input: {
        contact: {
          email: 'ewa@example.com',
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123123123',
        },
        shippingAddress: {
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
        invoice: {
          recipientType: 'private',
          companyName: null,
          taxId: null,
          invoiceAddress: null,
        },
      },
    });

    expect(result).toEqual({
      isValid: false,
      value: null,
      errors: {
        contact: {
          email: 'Adres e-mail konta klienta nie może zostać zmieniony.',
        },
        formErrors: [
          'Nie udało się zapisać danych konta, ponieważ formularz zawiera błędy.',
        ],
      },
    });
  });
});

describe('updateCustomerAccountProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates only reusable customer profile defaults for the authenticated owner', async () => {
    const mocks = setupSupabaseMock(
      [
        {
          data: createCustomerProfileRow(),
          error: null,
        },
      ],
      {
        data: createCustomerProfileRow({
          first_name: 'Adam',
          last_name: 'Nowak',
          phone: '987987987',
          default_invoice_data: null,
        }),
        error: null,
      },
    );

    const result = await updateCustomerAccountProfile({
      authUserId: 'auth-user-1',
      normalizedEmail: 'jan@example.com',
      now: new Date('2026-04-28T09:00:00.000Z'),
      input: {
        contact: {
          email: 'jan@example.com',
          firstName: 'Adam',
          lastName: 'Nowak',
          phone: '987987987',
        },
        shippingAddress: {
          firstName: 'Adam',
          lastName: 'Nowak',
          phone: '987987987',
          streetName: 'Nowa',
          buildingNumber: '10',
          apartmentNumber: null,
          postalCode: '00-010',
          city: 'Warszawa',
          country: 'PL',
        },
        invoice: {
          recipientType: 'private',
          companyName: null,
          taxId: null,
          invoiceAddress: null,
        },
      },
    });

    expect(mocks.updateMock).toHaveBeenCalledWith({
      first_name: 'Adam',
      last_name: 'Nowak',
      phone: '987987987',
      default_shipping_address: {
        firstName: 'Adam',
        lastName: 'Nowak',
        phone: '987987987',
        streetName: 'Nowa',
        buildingNumber: '10',
        apartmentNumber: null,
        postalCode: '00-010',
        city: 'Warszawa',
        country: 'PL',
      },
      default_invoice_data: null,
      updated_at: '2026-04-28T09:00:00.000Z',
    });
    expect(mocks.updateEqMock).toHaveBeenCalledWith('id', 'profile-1');
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'updated',
        profile: expect.objectContaining({
          contact: {
            email: 'jan@example.com',
            firstName: 'Adam',
            lastName: 'Nowak',
            phone: '987987987',
          },
        }),
      }),
    );
  });

  it('returns not_found before updating when no matching profile exists', async () => {
    const mocks = setupSupabaseMock([
      {
        data: null,
        error: null,
      },
      {
        data: null,
        error: null,
      },
    ]);

    const result = await updateCustomerAccountProfile({
      authUserId: 'auth-user-1',
      normalizedEmail: 'jan@example.com',
      input: {
        contact: {
          email: 'jan@example.com',
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123123123',
        },
        shippingAddress: {
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
        invoice: {
          recipientType: 'private',
          companyName: null,
          taxId: null,
          invoiceAddress: null,
        },
      },
    });

    expect(result).toEqual({
      kind: 'not_found',
    });
    expect(mocks.updateMock).not.toHaveBeenCalled();
  });

  it('does not update a profile linked to another auth user', async () => {
    const mocks = setupSupabaseMock([
      {
        data: null,
        error: null,
      },
      {
        data: createCustomerProfileRow({
          auth_user_id: 'other-auth-user',
        }),
        error: null,
      },
    ]);

    const result = await updateCustomerAccountProfile({
      authUserId: 'auth-user-1',
      normalizedEmail: 'jan@example.com',
      input: {
        contact: {
          email: 'jan@example.com',
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123123123',
        },
        shippingAddress: {
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
        invoice: {
          recipientType: 'private',
          companyName: null,
          taxId: null,
          invoiceAddress: null,
        },
      },
    });

    expect(result).toEqual({
      kind: 'ownership_mismatch',
    });
    expect(mocks.updateMock).not.toHaveBeenCalled();
  });
});
