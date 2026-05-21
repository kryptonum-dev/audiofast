import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import { persistPaidCheckoutOrderProfile } from './payment-profile-persistence';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

function createOrderSelectChain(result: { data: unknown; error: unknown }) {
  const singleMock = vi.fn().mockResolvedValue(result);
  const eqMock = vi.fn(() => ({
    single: singleMock,
  }));

  return {
    select: vi.fn(() => ({
      eq: eqMock,
    })),
    eqMock,
    singleMock,
  };
}

function createProfileMaybeSingleChain(
  results: Array<{ data: unknown; error: unknown }>,
) {
  const maybeSingleMock = vi.fn();

  results.forEach((result) => {
    maybeSingleMock.mockResolvedValueOnce(result);
  });

  const eqMock = vi.fn(() => ({
    maybeSingle: maybeSingleMock,
  }));
  const ilikeMock = vi.fn(() => ({
    maybeSingle: maybeSingleMock,
  }));

  return {
    select: vi.fn(() => ({
      eq: eqMock,
      ilike: ilikeMock,
    })),
    eqMock,
    ilikeMock,
    maybeSingleMock,
  };
}

function createInsertChain(result: { data: unknown; error: unknown }) {
  const singleMock = vi.fn().mockResolvedValue(result);
  const selectMock = vi.fn(() => ({
    single: singleMock,
  }));

  return {
    insert: vi.fn(() => ({
      select: selectMock,
    })),
    selectMock,
    singleMock,
  };
}

function createProfileUpdateChain(result: { data: unknown; error: unknown }) {
  const singleMock = vi.fn().mockResolvedValue(result);
  const selectMock = vi.fn(() => ({
    single: singleMock,
  }));
  const eqMock = vi.fn(() => ({
    select: selectMock,
  }));

  return {
    update: vi.fn(() => ({
      eq: eqMock,
    })),
    eqMock,
    selectMock,
    singleMock,
  };
}

function createOrderLinkUpdateChain(result: { error: unknown }) {
  const eqMock = vi.fn().mockResolvedValue(result);

  return {
    update: vi.fn(() => ({
      eq: eqMock,
    })),
    eqMock,
  };
}

function createPaidOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_number: 'AF-2026-00001',
    current_status: 'awaiting_confirmation',
    customer_email: 'Jan@Example.com',
    customer_profile_id: null,
    customer_snapshot: {
      email: 'jan@example.com',
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123123123',
    },
    shipping_address_snapshot: {
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
    invoice_data: {
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
      storagePath: null,
      attachedAt: null,
    },
    paid_at: '2026-04-22T10:00:00.000Z',
    profile_persistence: {
      shouldEnsureProfileAfterSuccessfulPayment: true,
      shouldStoreCheckoutDefaultsAfterSuccessfulPayment: true,
      authUserIdAtCheckout: null,
      reason: 'create_profile_with_defaults',
    },
    ...overrides,
  };
}

function createCustomerProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    auth_user_id: null,
    email: 'jan@example.com',
    first_name: 'Jan',
    last_name: 'Kowalski',
    phone: '123123123',
    default_shipping_address: {},
    default_invoice_data: null,
    created_at: '2026-04-22T10:00:00.000Z',
    updated_at: '2026-04-22T10:00:00.000Z',
    ...overrides,
  };
}

describe('persistPaidCheckoutOrderProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a lightweight profile for a paid guest order and links the order', async () => {
    const orderSelect = createOrderSelectChain({
      data: createPaidOrderRow(),
      error: null,
    });
    const profileSelect = createProfileMaybeSingleChain([
      {
        data: null,
        error: null,
      },
    ]);
    const profileInsert = createInsertChain({
      data: createCustomerProfileRow(),
      error: null,
    });
    const orderLinkUpdate = createOrderLinkUpdateChain({
      error: null,
    });
    const fromMock = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: orderSelect.select,
          update: orderLinkUpdate.update,
        };
      }

      if (table === 'customer_profiles') {
        return {
          select: profileSelect.select,
          insert: profileInsert.insert,
          update: vi.fn(),
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await persistPaidCheckoutOrderProfile({
      orderId: 'order-1',
    });

    expect(profileInsert.insert).toHaveBeenCalledWith({
      auth_user_id: null,
      email: 'jan@example.com',
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
    });
    expect(orderLinkUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_profile_id: 'profile-1',
      }),
    );
    expect(result).toEqual({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      profileId: 'profile-1',
      createdProfile: true,
      updatedProfile: false,
      linkedAuthUser: false,
      linkedOrderToProfile: true,
      skippedReason: null,
    });
  });

  it('links a paid guest order to an existing profile without overwriting defaults', async () => {
    const orderSelect = createOrderSelectChain({
      data: createPaidOrderRow(),
      error: null,
    });
    const existingProfile = createCustomerProfileRow({
      default_shipping_address: {
        firstName: 'Old',
      },
      default_invoice_data: {
        recipientType: 'company',
        companyName: 'Old Company',
      },
    });
    const profileSelect = createProfileMaybeSingleChain([
      {
        data: existingProfile,
        error: null,
      },
    ]);
    const orderLinkUpdate = createOrderLinkUpdateChain({
      error: null,
    });
    const profileUpdate = vi.fn();
    const fromMock = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: orderSelect.select,
          update: orderLinkUpdate.update,
        };
      }

      if (table === 'customer_profiles') {
        return {
          select: profileSelect.select,
          insert: vi.fn(),
          update: profileUpdate,
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await persistPaidCheckoutOrderProfile({
      orderId: 'order-1',
    });

    expect(profileUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      profileId: 'profile-1',
      createdProfile: false,
      updatedProfile: false,
      linkedAuthUser: false,
      linkedOrderToProfile: true,
      skippedReason: null,
    });
  });

  it('keeps authenticated paid orders unchanged when defaults should not be stored', async () => {
    const orderSelect = createOrderSelectChain({
      data: createPaidOrderRow({
        customer_profile_id: 'profile-1',
        profile_persistence: {
          shouldEnsureProfileAfterSuccessfulPayment: true,
          shouldStoreCheckoutDefaultsAfterSuccessfulPayment: false,
          authUserIdAtCheckout: 'user-1',
          reason: 'update_profile_without_defaults',
        },
      }),
      error: null,
    });
    const profileSelect = createProfileMaybeSingleChain([
      {
        data: createCustomerProfileRow({
          id: 'profile-1',
          auth_user_id: 'user-1',
          default_shipping_address: {
            firstName: 'Saved',
          },
        }),
        error: null,
      },
    ]);
    const profileUpdate = vi.fn();
    const orderLinkUpdate = vi.fn();
    const fromMock = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: orderSelect.select,
          update: orderLinkUpdate,
        };
      }

      if (table === 'customer_profiles') {
        return {
          select: profileSelect.select,
          insert: vi.fn(),
          update: profileUpdate,
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await persistPaidCheckoutOrderProfile({
      orderId: 'order-1',
    });

    expect(profileUpdate).not.toHaveBeenCalled();
    expect(orderLinkUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      profileId: 'profile-1',
      createdProfile: false,
      updatedProfile: false,
      linkedAuthUser: false,
      linkedOrderToProfile: false,
      skippedReason: null,
    });
  });

  it('updates reusable defaults for authenticated paid orders when requested', async () => {
    const orderSelect = createOrderSelectChain({
      data: createPaidOrderRow({
        customer_profile_id: 'profile-1',
        profile_persistence: {
          shouldEnsureProfileAfterSuccessfulPayment: true,
          shouldStoreCheckoutDefaultsAfterSuccessfulPayment: true,
          authUserIdAtCheckout: 'user-1',
          reason: 'update_profile_with_defaults',
        },
      }),
      error: null,
    });
    const profileSelect = createProfileMaybeSingleChain([
      {
        data: createCustomerProfileRow({
          id: 'profile-1',
          auth_user_id: 'user-1',
          first_name: 'Janusz',
          default_shipping_address: {
            firstName: 'Old',
          },
        }),
        error: null,
      },
    ]);
    const profileUpdate = createProfileUpdateChain({
      data: createCustomerProfileRow({
        id: 'profile-1',
        auth_user_id: 'user-1',
        email: 'jan@example.com',
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
      }),
      error: null,
    });
    const fromMock = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: orderSelect.select,
          update: vi.fn(),
        };
      }

      if (table === 'customer_profiles') {
        return {
          select: profileSelect.select,
          insert: vi.fn(),
          update: profileUpdate.update,
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await persistPaidCheckoutOrderProfile({
      orderId: 'order-1',
    });

    expect(profileUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Jan',
        default_shipping_address: expect.objectContaining({
          streetName: 'Testowa',
        }),
        default_invoice_data: expect.objectContaining({
          companyName: 'Audiofast',
        }),
        updated_at: expect.any(String),
      }),
    );
    expect(result).toEqual({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      profileId: 'profile-1',
      createdProfile: false,
      updatedProfile: true,
      linkedAuthUser: false,
      linkedOrderToProfile: false,
      skippedReason: null,
    });
  });

  it('creates and links an authenticated profile when none exists yet', async () => {
    const orderSelect = createOrderSelectChain({
      data: createPaidOrderRow({
        profile_persistence: {
          shouldEnsureProfileAfterSuccessfulPayment: true,
          shouldStoreCheckoutDefaultsAfterSuccessfulPayment: true,
          authUserIdAtCheckout: 'user-1',
          reason: 'create_profile_with_defaults',
        },
      }),
      error: null,
    });
    const profileSelect = createProfileMaybeSingleChain([
      {
        data: null,
        error: null,
      },
      {
        data: null,
        error: null,
      },
    ]);
    const profileInsert = createInsertChain({
      data: createCustomerProfileRow({
        auth_user_id: 'user-1',
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
      }),
      error: null,
    });
    const orderLinkUpdate = createOrderLinkUpdateChain({
      error: null,
    });
    const fromMock = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: orderSelect.select,
          update: orderLinkUpdate.update,
        };
      }

      if (table === 'customer_profiles') {
        return {
          select: profileSelect.select,
          insert: profileInsert.insert,
          update: vi.fn(),
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await persistPaidCheckoutOrderProfile({
      orderId: 'order-1',
    });

    expect(profileInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        auth_user_id: 'user-1',
        default_shipping_address: expect.objectContaining({
          streetName: 'Testowa',
        }),
        default_invoice_data: expect.objectContaining({
          companyName: 'Audiofast',
        }),
      }),
    );
    expect(result).toEqual({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      profileId: 'profile-1',
      createdProfile: true,
      updatedProfile: false,
      linkedAuthUser: true,
      linkedOrderToProfile: true,
      skippedReason: null,
    });
  });
});
