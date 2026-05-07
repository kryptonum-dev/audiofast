import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lookupCouponDefinition } from '@/src/app/actions/cart-coupon';
import { createClient as createServerClient } from '@/src/global/supabase/server';

vi.mock('@/src/global/supabase/server', () => ({
  createClient: vi.fn(),
}));

const maybeSingleMock = vi.fn();
const limitMock = vi.fn(() => ({
  maybeSingle: maybeSingleMock,
}));
const orderMock = vi.fn(() => ({
  limit: limitMock,
}));
const isMock = vi.fn(() => ({
  order: orderMock,
}));
const ilikeMock = vi.fn(() => ({
  is: isMock,
}));
const selectMock = vi.fn(() => ({
  ilike: ilikeMock,
}));
const fromMock = vi.fn(() => ({
  select: selectMock,
}));

describe('lookupCouponDefinition', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createServerClient).mockReturnValue({
      from: fromMock,
    } as never);
  });

  it('normalizes code lookup and maps a coupon row into cart coupon definition', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'coupon-1',
        code: 'save20',
        is_active: true,
        discount_type: 'fixed_order',
        discount_value_cents: 20_00,
        discount_percent: null,
        product_keys: null,
        usage_limit: null,
        usage_count: 2,
        starts_at: null,
        expires_at: null,
        created_at: '2026-04-14T00:00:00.000Z',
        updated_at: '2026-04-14T00:00:00.000Z',
      },
      error: null,
    });

    const result = await lookupCouponDefinition(' save20 ');

    expect(result).toEqual({
      status: 'found',
      coupon: {
        id: 'coupon-1',
        code: 'SAVE20',
        isActive: true,
        discountType: 'fixed_order',
        discountValueCents: 20_00,
        discountPercent: null,
        productKeys: null,
        usageLimit: null,
        usageCount: 2,
        startsAt: null,
        expiresAt: null,
      },
    });
    expect(fromMock).toHaveBeenCalledWith('coupons');
    expect(ilikeMock).toHaveBeenCalledWith('code', 'SAVE20');
    expect(isMock).toHaveBeenCalledWith('archived_at', null);
    expect(orderMock).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(limitMock).toHaveBeenCalledWith(1);
  });

  it('returns a typed not-found result for missing coupons', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await lookupCouponDefinition('missing');

    expect(result).toEqual({
      status: 'not_found',
      code: 'MISSING',
      message: 'Kod rabatowy nie istnieje.',
    });
  });

  it('returns an error result for malformed coupon definitions', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'coupon-1',
        code: 'save20',
        is_active: true,
        discount_type: 'fixed_order',
        discount_value_cents: null,
        discount_percent: null,
        product_keys: null,
        usage_limit: null,
        usage_count: 0,
        starts_at: null,
        expires_at: null,
        created_at: '2026-04-14T00:00:00.000Z',
        updated_at: '2026-04-14T00:00:00.000Z',
      },
      error: null,
    });

    const result = await lookupCouponDefinition('save20');

    expect(result).toEqual({
      status: 'error',
      code: 'SAVE20',
      message: 'Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie.',
    });
  });

  it('returns an error result when Supabase lookup fails', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'boom',
      },
    });

    const result = await lookupCouponDefinition('save20');

    expect(result).toEqual({
      status: 'error',
      code: 'SAVE20',
      message: 'Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie.',
    });
  });
});
