import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateCustomerAccountProfileAction } from '@/src/app/actions/customer-account-profile';
import type { CustomerAccountProfile } from '@/src/global/b2c/customer-auth/server/customer-account-profile';

import CustomerAccountDetailsForm from './CustomerAccountDetailsForm';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/src/app/actions/customer-account-profile', () => ({
  updateCustomerAccountProfileAction: vi.fn(),
}));

function createProfile(
  overrides: Partial<CustomerAccountProfile> = {},
): CustomerAccountProfile {
  return {
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
    defaultInvoiceData: null,
    hasUsableCheckoutDefaults: true,
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-28T08:00:00.000Z',
    ...overrides,
  };
}

function createDeferredActionResult() {
  let resolve!: (
    value: Awaited<ReturnType<typeof updateCustomerAccountProfileAction>>,
  ) => void;
  const promise = new Promise<
    Awaited<ReturnType<typeof updateCustomerAccountProfileAction>>
  >((resolver) => {
    resolve = resolver;
  });

  return {
    promise,
    resolve,
  };
}

describe('CustomerAccountDetailsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      refresh: refreshMock,
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    } as never);
    vi.mocked(updateCustomerAccountProfileAction).mockResolvedValue({
      ok: true,
      value: {
        kind: 'updated',
        profile: createProfile(),
      },
    });
  });

  it('renders reusable account defaults', () => {
    render(<CustomerAccountDetailsForm profile={createProfile()} />);

    expect(screen.getByRole('textbox', { name: 'Adres e-mail' })).toHaveValue(
      'jan@example.com',
    );
    expect(
      screen.getByRole('textbox', { name: 'Adres e-mail' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: 'Adres e-mail' }),
    ).not.toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: 'Imię' })).toHaveValue('Jan');
    expect(screen.getByRole('textbox', { name: 'Ulica' })).toHaveValue(
      'Testowa',
    );
    expect(
      screen.queryByText(/newsletter|marketing|zgodę marketingową/i),
    ).not.toBeInTheDocument();
  });

  it('submits changed reusable defaults and refreshes the page on success', async () => {
    const user = userEvent.setup();

    render(<CustomerAccountDetailsForm profile={createProfile()} />);

    await user.clear(screen.getByRole('textbox', { name: 'Imię' }));
    await user.type(screen.getByRole('textbox', { name: 'Imię' }), 'Adam');
    await user.click(
      screen.getByRole('button', { name: /Zapisz dane konta/i }),
    );

    await waitFor(() => {
      expect(updateCustomerAccountProfileAction).toHaveBeenCalledWith(
        expect.objectContaining({
          contact: expect.objectContaining({
            email: 'jan@example.com',
            firstName: 'Adam',
          }),
          invoice: {
            recipientType: 'private',
            companyName: null,
            taxId: null,
            invoiceAddress: null,
          },
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith('Dane konta zostały zapisane.');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('keeps company selection usable after a successful save reset', async () => {
    const user = userEvent.setup();

    render(<CustomerAccountDetailsForm profile={createProfile()} />);

    await user.click(
      screen.getByRole('button', { name: /Zapisz dane konta/i }),
    );

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Dane konta zostały zapisane.',
      );
    });

    await user.click(screen.getByRole('radio', { name: 'Firma' }));

    expect(screen.getByRole('textbox', { name: 'Nazwa firmy' })).toBeVisible();
  });

  it('shows company fields and maps shared shipping address into company data', async () => {
    const user = userEvent.setup();

    render(<CustomerAccountDetailsForm profile={createProfile()} />);

    await user.click(screen.getByRole('radio', { name: 'Firma' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Nazwa firmy' }),
      'Audiofast',
    );
    await user.type(screen.getByRole('textbox', { name: 'NIP' }), '1234567890');
    await user.click(
      screen.getByRole('button', { name: /Zapisz dane konta/i }),
    );

    await waitFor(() => {
      expect(updateCustomerAccountProfileAction).toHaveBeenCalledWith(
        expect.objectContaining({
          invoice: {
            recipientType: 'company',
            companyName: 'Audiofast',
            taxId: '1234567890',
            invoiceAddress: {
              streetName: 'Testowa',
              buildingNumber: '1',
              apartmentNumber: null,
              postalCode: '00-001',
              city: 'Warszawa',
              country: 'PL',
            },
          },
        }),
      );
    });
  });

  it('disables inputs, checkboxes, and account-type radios while saving', async () => {
    const user = userEvent.setup();
    const deferred = createDeferredActionResult();

    vi.mocked(updateCustomerAccountProfileAction).mockReturnValue(
      deferred.promise,
    );

    render(<CustomerAccountDetailsForm profile={createProfile()} />);

    await user.click(
      screen.getByRole('button', { name: /Zapisz dane konta/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Imię' })).toBeDisabled();
    });
    expect(
      screen.getByRole('checkbox', {
        name: 'Chcę zapisać inne dane odbiorcy dla dostawy',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: 'Osoba fizyczna' }),
    ).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Firma' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Zapisz dane konta/i }),
    ).toBeDisabled();

    deferred.resolve({
      ok: true,
      value: {
        kind: 'updated',
        profile: createProfile(),
      },
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Dane konta zostały zapisane.',
      );
    });
  });

  it('maps server validation errors back to form fields', async () => {
    const user = userEvent.setup();

    vi.mocked(updateCustomerAccountProfileAction).mockResolvedValue({
      ok: false,
      error: {
        kind: 'validation_error',
        errors: {
          contact: {
            firstName: 'Podaj imię.',
          },
          formErrors: [
            'Nie udało się zapisać danych konta, ponieważ formularz zawiera błędy.',
          ],
        },
      },
    });

    render(<CustomerAccountDetailsForm profile={createProfile()} />);

    await user.click(
      screen.getByRole('button', { name: /Zapisz dane konta/i }),
    );

    expect(await screen.findByText('Podaj imię.')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      'Nie udało się zapisać danych konta, ponieważ formularz zawiera błędy.',
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
