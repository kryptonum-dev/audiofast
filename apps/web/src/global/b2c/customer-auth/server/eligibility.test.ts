import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import {
  CustomerAuthEligibilityError,
  resolveCustomerAuthEligibility,
} from './eligibility';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

function createOrdersSelectChain(result: { data: unknown; error: unknown }) {
  const orderMock = vi.fn().mockResolvedValue(result);
  const ilikeMock = vi.fn(() => ({
    order: orderMock,
  }));

  return {
    select: vi.fn(() => ({
      ilike: ilikeMock,
    })),
    ilikeMock,
    orderMock,
  };
}

function createProfileMaybeSingleChain(result: { data: unknown; error: unknown }) {
  const maybeSingleMock = vi.fn().mockResolvedValue(result);
  const ilikeMock = vi.fn(() => ({
    maybeSingle: maybeSingleMock,
  }));

  return {
    select: vi.fn(() => ({
      ilike: ilikeMock,
    })),
    ilikeMock,
    maybeSingleMock,
  };
}

function createOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_number: 'AF-2026-00001',
    current_status: 'paid',
    payable_until: '2026-04-25T12:00:00.000Z',
    customer_profile_id: 'profile-1',
    created_at: '2026-04-24T10:00:00.000Z',
    ...overrides,
  };
}

function createProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    email: 'jan@example.com',
    auth_user_id: null,
    ...overrides,
  };
}

describe('resolveCustomerAuthEligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invalid_email without touching Supabase for malformed addresses', async () => {
    const result = await resolveCustomerAuthEligibility({
      email: 'not-an-email',
    });

    expect(createAdminClient).not.toHaveBeenCalled();
    expect(result).toEqual({
      normalizedEmail: 'not-an-email',
      isValidEmail: false,
      isEligible: false,
      reason: 'invalid_email',
      matchedOrders: [],
      matchedProfile: null,
    });
  });

  it('marks post-payment orders as eligible and normalizes the lookup email', async () => {
    const orderSelect = createOrdersSelectChain({
      data: [createOrderRow()],
      error: null,
    });
    const profileSelect = createProfileMaybeSingleChain({
      data: createProfileRow(),
      error: null,
    });
    const fromMock = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: orderSelect.select,
        };
      }

      if (table === 'customer_profiles') {
        return {
          select: profileSelect.select,
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await resolveCustomerAuthEligibility({
      email: '  Jan@Example.com  ',
      now: new Date('2026-04-24T11:00:00.000Z'),
    });

    expect(orderSelect.ilikeMock).toHaveBeenCalledWith(
      'customer_email',
      'jan@example.com',
    );
    expect(profileSelect.ilikeMock).toHaveBeenCalledWith(
      'email',
      'jan@example.com',
    );
    expect(result).toEqual({
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
    });
  });

  it('treats active awaiting_payment orders as eligible', async () => {
    const orderSelect = createOrdersSelectChain({
      data: [
        createOrderRow({
          current_status: 'awaiting_payment',
          payable_until: '2026-04-24T12:30:00.000Z',
        }),
      ],
      error: null,
    });
    const profileSelect = createProfileMaybeSingleChain({
      data: createProfileRow(),
      error: null,
    });
    const fromMock = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: orderSelect.select,
        };
      }

      if (table === 'customer_profiles') {
        return {
          select: profileSelect.select,
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await resolveCustomerAuthEligibility({
      email: 'jan@example.com',
      now: new Date('2026-04-24T11:00:00.000Z'),
    });

    expect(result.isEligible).toBe(true);
    expect(result.reason).toBe('eligible_order_access');
    expect(result.matchedOrders[0]?.accessKind).toBe('awaiting_payment_active');
  });

  it('rejects emails whose only matching orders are expired awaiting_payment orders', async () => {
    const orderSelect = createOrdersSelectChain({
      data: [
        createOrderRow({
          current_status: 'awaiting_payment',
          payable_until: '2026-04-24T10:00:00.000Z',
        }),
      ],
      error: null,
    });
    const profileSelect = createProfileMaybeSingleChain({
      data: createProfileRow(),
      error: null,
    });
    const fromMock = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: orderSelect.select,
        };
      }

      if (table === 'customer_profiles') {
        return {
          select: profileSelect.select,
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await resolveCustomerAuthEligibility({
      email: 'jan@example.com',
      now: new Date('2026-04-24T11:00:00.000Z'),
    });

    expect(result.isEligible).toBe(false);
    expect(result.reason).toBe('only_expired_awaiting_payment_orders');
    expect(result.matchedOrders[0]?.accessKind).toBe('awaiting_payment_expired');
  });

  it('keeps profile metadata internal without making profile-only emails eligible', async () => {
    const orderSelect = createOrdersSelectChain({
      data: [],
      error: null,
    });
    const profileSelect = createProfileMaybeSingleChain({
      data: createProfileRow({
        auth_user_id: 'auth-user-1',
      }),
      error: null,
    });
    const fromMock = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: orderSelect.select,
        };
      }

      if (table === 'customer_profiles') {
        return {
          select: profileSelect.select,
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await resolveCustomerAuthEligibility({
      email: 'jan@example.com',
    });

    expect(result).toEqual({
      normalizedEmail: 'jan@example.com',
      isValidEmail: true,
      isEligible: false,
      reason: 'no_matching_orders',
      matchedOrders: [],
      matchedProfile: {
        id: 'profile-1',
        email: 'jan@example.com',
        authUserId: 'auth-user-1',
      },
    });
  });

  it('throws a typed database error when the orders lookup fails', async () => {
    const orderSelect = createOrdersSelectChain({
      data: null,
      error: {
        message: 'boom',
      },
    });
    const profileSelect = createProfileMaybeSingleChain({
      data: null,
      error: null,
    });
    const fromMock = vi.fn((table: string) => {
      if (table === 'orders') {
        return {
          select: orderSelect.select,
        };
      }

      if (table === 'customer_profiles') {
        return {
          select: profileSelect.select,
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    await expect(
      resolveCustomerAuthEligibility({
        email: 'jan@example.com',
      }),
    ).rejects.toBeInstanceOf(CustomerAuthEligibilityError);
  });
});
