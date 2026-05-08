import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CustomerPanelNav from './CustomerPanelNav';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();

  return {
    ...actual,
    useFormStatus: vi.fn(),
  };
});

vi.mock('@/src/app/actions/customer-auth-logout', () => ({
  logoutCustomerAuthAction: vi.fn(),
}));

function mockFormStatus(pending: boolean) {
  vi.mocked(useFormStatus).mockReturnValue({
    pending,
    data: null,
    method: null,
    action: null,
  } as ReturnType<typeof useFormStatus>);
}

describe('CustomerPanelNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue('/konto-klienta/zamowienia/');
    mockFormStatus(false);
  });

  it('renders the logout action in its idle state', () => {
    render(<CustomerPanelNav customerDisplayName="Oliwier Sellig" />);

    const logoutButton = screen.getByRole('button', { name: 'Wyloguj się' });

    expect(logoutButton).toBeEnabled();
    expect(logoutButton).not.toHaveAttribute('aria-busy');
    expect(logoutButton).toHaveAttribute('data-pending', 'false');
  });

  it('shows a disabled pending state while the logout action is submitting', () => {
    mockFormStatus(true);

    render(<CustomerPanelNav customerDisplayName="Oliwier Sellig" />);

    const logoutButton = screen.getByRole('button', {
      name: 'Wylogowywanie...',
    });

    expect(logoutButton).toBeDisabled();
    expect(logoutButton).toHaveAttribute('aria-busy', 'true');
    expect(logoutButton).toHaveAttribute('data-pending', 'true');
  });
});
