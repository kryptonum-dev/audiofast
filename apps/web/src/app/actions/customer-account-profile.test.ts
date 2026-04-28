import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CustomerAccountProfileSubmitInput } from '@/src/global/b2c/customer-auth/account-profile-form';
import { updateCustomerAccountProfile } from '@/src/global/b2c/customer-auth/server/customer-account-profile';
import { loadCustomerAuthSession } from '@/src/global/b2c/customer-auth/server/session';

import { updateCustomerAccountProfileAction } from './customer-account-profile';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock(
  '@/src/global/b2c/customer-auth/server/customer-account-profile',
  () => ({
    updateCustomerAccountProfile: vi.fn(),
  }),
);

vi.mock('@/src/global/b2c/customer-auth/server/session', () => ({
  loadCustomerAuthSession: vi.fn(),
}));

function createInput(): CustomerAccountProfileSubmitInput {
  return {
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
  };
}

describe('updateCustomerAccountProfileAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated customers', async () => {
    vi.mocked(loadCustomerAuthSession).mockResolvedValue({
      isAuthenticated: false,
      authUser: null,
      normalizedEmail: null,
      profile: null,
    });

    const result = await updateCustomerAccountProfileAction(createInput());

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'unauthenticated',
      },
    });
    expect(updateCustomerAccountProfile).not.toHaveBeenCalled();
  });

  it('updates the authenticated customer profile and revalidates the account page', async () => {
    const input = createInput();

    vi.mocked(loadCustomerAuthSession).mockResolvedValue({
      isAuthenticated: true,
      authUser: {
        id: 'auth-user-1',
        email: 'jan@example.com',
        email_confirmed_at: '2026-04-28T08:00:00.000Z',
        created_at: '2026-04-01T08:00:00.000Z',
        last_sign_in_at: '2026-04-28T08:00:00.000Z',
      },
      normalizedEmail: 'jan@example.com',
      profile: null,
    });
    vi.mocked(updateCustomerAccountProfile).mockResolvedValue({
      kind: 'updated',
      profile: {
        id: 'profile-1',
        email: 'jan@example.com',
        authUserId: 'auth-user-1',
        contact: input.contact,
        defaultShippingAddress: input.shippingAddress,
        defaultInvoiceData: null,
        hasUsableCheckoutDefaults: true,
        createdAt: '2026-04-01T08:00:00.000Z',
        updatedAt: '2026-04-28T09:00:00.000Z',
      },
    });

    const result = await updateCustomerAccountProfileAction(input);

    expect(updateCustomerAccountProfile).toHaveBeenCalledWith({
      authUserId: 'auth-user-1',
      input,
      normalizedEmail: 'jan@example.com',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/konto-klienta/dane-konta/');
    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'updated',
        profile: expect.objectContaining({
          id: 'profile-1',
        }),
      },
    });
  });

  it('returns domain errors without revalidating', async () => {
    vi.mocked(loadCustomerAuthSession).mockResolvedValue({
      isAuthenticated: true,
      authUser: {
        id: 'auth-user-1',
        email: 'jan@example.com',
        email_confirmed_at: '2026-04-28T08:00:00.000Z',
        created_at: '2026-04-01T08:00:00.000Z',
        last_sign_in_at: '2026-04-28T08:00:00.000Z',
      },
      normalizedEmail: 'jan@example.com',
      profile: null,
    });
    vi.mocked(updateCustomerAccountProfile).mockResolvedValue({
      kind: 'validation_error',
      errors: {
        contact: {
          firstName: 'Podaj imię.',
        },
        formErrors: ['Nie udało się zapisać danych konta.'],
      },
    });

    const result = await updateCustomerAccountProfileAction(createInput());

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'validation_error',
        errors: {
          contact: {
            firstName: 'Podaj imię.',
          },
          formErrors: ['Nie udało się zapisać danych konta.'],
        },
      },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
