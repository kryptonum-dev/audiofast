import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadCustomerOrdersPageData } from './orders-page';
import { loadCustomerAuthSession } from './session';

vi.mock('./session', () => ({
  loadCustomerAuthSession: vi.fn(),
}));

function createAuthenticatedSession() {
  return {
    isAuthenticated: true,
    normalizedEmail: 'jan@example.com',
    authUser: {
      id: 'auth-user-1',
      email: 'jan@example.com',
      email_confirmed_at: '2026-04-24T11:00:00.000Z',
      created_at: '2026-04-24T11:00:00.000Z',
      last_sign_in_at: null,
    },
    profile: null,
  } as const;
}

describe('loadCustomerOrdersPageData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a login redirect target for unauthenticated customers', async () => {
    vi.mocked(loadCustomerAuthSession).mockResolvedValue({
      isAuthenticated: false,
      authUser: null,
      normalizedEmail: null,
      profile: null,
    });

    const result = await loadCustomerOrdersPageData();

    expect(result).toEqual({
      kind: 'unauthenticated',
      redirectTo: '/konto-klienta/?returnTo=%2Fkonto-klienta%2Fzamowienia%2F',
    });
  });

  it('returns the authenticated normalized email for the orders listing', async () => {
    vi.mocked(loadCustomerAuthSession).mockResolvedValue(
      createAuthenticatedSession(),
    );

    const result = await loadCustomerOrdersPageData();

    expect(result).toEqual({
      kind: 'authenticated',
      normalizedEmail: 'jan@example.com',
    });
  });
});
