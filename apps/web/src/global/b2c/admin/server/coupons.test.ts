import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import {
  AdminCouponError,
  adminCouponTesting,
  archiveAdminCoupon,
  createAdminCoupon,
  updateAdminCoupon,
} from './coupons';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const BASE_COUPON = {
  archived_at: null,
  code: 'SAVE10',
  created_at: '2026-05-01T08:00:00.000Z',
  discount_percent: 10,
  discount_type: 'percent_order',
  discount_value_cents: null,
  expires_at: null,
  id: 'coupon-1',
  is_active: true,
  product_keys: null,
  starts_at: null,
  updated_at: '2026-05-01T08:00:00.000Z',
  usage_count: 0,
  usage_limit: null,
};

describe('admin coupon helpers', () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReset();
  });

  it('normalizes a fixed product coupon create payload', () => {
    expect(
      adminCouponTesting.getCouponDraft({
        input: {
          code: ' audio-100 ',
          discountType: 'fixed_product',
          discountValueCents: 10000,
          isActive: true,
          productKeys: [' amp-1 ', 'amp-1', 'speaker-1'],
          usageLimit: 5,
        },
        mode: 'create',
      }),
    ).toEqual({
      code: 'AUDIO-100',
      discount_percent: null,
      discount_type: 'fixed_product',
      discount_value_cents: 10000,
      expires_at: null,
      is_active: true,
      product_keys: ['amp-1', 'speaker-1'],
      starts_at: null,
      usage_limit: 5,
    });
  });

  it('rejects invalid or dangerous coupon payloads', () => {
    expect(() =>
      adminCouponTesting.getCouponDraft({
        input: {
          code: 'bad',
          discountType: 'percent_product',
          discountPercent: 10,
          productKeys: [],
        },
        mode: 'create',
      }),
    ).toThrow(AdminCouponError);

    expect(() =>
      adminCouponTesting.getCouponDraft({
        existing: {
          ...BASE_COUPON,
          usage_count: 3,
        },
        input: {
          usageLimit: 2,
        },
        mode: 'update',
      }),
    ).toThrow(AdminCouponError);

    expect(() =>
      adminCouponTesting.getCouponDraft({
        input: {
          code: 'bad',
          discountType: 'percent_order',
          discountPercent: 10,
          usageCount: 1,
        },
        mode: 'create',
      }),
    ).toThrow(AdminCouponError);
  });

  it('derives operational coupon status', () => {
    const now = new Date('2026-05-06T08:00:00.000Z');

    expect(adminCouponTesting.getDerivedStatus(BASE_COUPON, now)).toBe('active');
    expect(
      adminCouponTesting.getDerivedStatus(
        {
          ...BASE_COUPON,
          is_active: false,
        },
        now,
      ),
    ).toBe('inactive');
    expect(
      adminCouponTesting.getDerivedStatus(
        {
          ...BASE_COUPON,
          starts_at: '2026-05-07T08:00:00.000Z',
        },
        now,
      ),
    ).toBe('scheduled');
    expect(
      adminCouponTesting.getDerivedStatus(
        {
          ...BASE_COUPON,
          usage_count: 10,
          usage_limit: 10,
        },
        now,
      ),
    ).toBe('usage_limit_reached');
  });

  it('rejects updating a coupon code to another existing coupon code', async () => {
    const adminClientMock = createAdminClientMock([
      {
        data: BASE_COUPON,
        error: null,
      },
      {
        data: {
          id: 'coupon-2',
        },
        error: null,
      },
    ]);

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    await expect(
      updateAdminCoupon({
        couponId: 'coupon-1',
        input: {
          code: 'already-used',
        },
      }),
    ).rejects.toMatchObject({
      code: 'coupon_code_conflict',
      message: 'Coupon code already exists.',
      status: 409,
    });

    expect(adminClientMock.from).toHaveBeenCalledTimes(2);
  });

  it('allows updating a coupon while keeping its own normalized code', async () => {
    const updatedCoupon = {
      ...BASE_COUPON,
      updated_at: '2026-05-02T08:00:00.000Z',
    };
    const adminClientMock = createAdminClientMock([
      {
        data: BASE_COUPON,
        error: null,
      },
      {
        data: updatedCoupon,
        error: null,
      },
    ]);

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    await expect(
      updateAdminCoupon({
        couponId: 'coupon-1',
        input: {
          code: ' save10 ',
        },
        now: new Date('2026-05-02T08:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      code: 'SAVE10',
      id: 'coupon-1',
    });

    expect(adminClientMock.from).toHaveBeenCalledTimes(2);
  });

  it('allows creating a coupon with a code used only by archived coupons', async () => {
    const createdCoupon = {
      ...BASE_COUPON,
      code: 'SAVE10',
      discount_percent: null,
      discount_type: 'fixed_order',
      discount_value_cents: 1000,
      id: 'coupon-3',
    };
    const adminClientMock = createAdminClientMock([
      {
        data: null,
        error: null,
      },
      {
        data: createdCoupon,
        error: null,
      },
    ]);

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    await expect(
      createAdminCoupon({
        input: {
          code: ' save10 ',
          discountType: 'fixed_order',
          discountValueCents: 1000,
        },
        now: new Date('2026-05-02T08:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      code: 'SAVE10',
      id: 'coupon-3',
    });
  });

  it('archives a coupon by filling archived_at and deactivating it', async () => {
    const now = new Date('2026-05-02T08:00:00.000Z');
    const archivedCoupon = {
      ...BASE_COUPON,
      archived_at: now.toISOString(),
      is_active: false,
      updated_at: now.toISOString(),
    };
    const adminClientMock = createAdminClientMock([
      {
        data: BASE_COUPON,
        error: null,
      },
      {
        data: archivedCoupon,
        error: null,
      },
    ]);

    vi.mocked(createAdminClient).mockReturnValue(adminClientMock as never);

    await expect(
      archiveAdminCoupon({
        couponId: 'coupon-1',
        now,
      }),
    ).resolves.toMatchObject({
      archivedAt: now.toISOString(),
      code: 'SAVE10',
      isActive: false,
    });
  });
});

function createAdminClientMock(
  responses: {
    data: unknown;
    error: unknown;
  }[],
) {
  let index = 0;

  return {
    from: vi.fn(() =>
      createQueryMock(() => {
        const response = responses[index++];

        if (!response) {
          throw new Error('Missing mocked Supabase response.');
        }

        return response;
      }),
    ),
  };
}

function createQueryMock(
  resolveResponse: () => {
    data: unknown;
    error: unknown;
  },
) {
  const query = {
    eq: vi.fn(() => query),
    ilike: vi.fn(() => query),
    insert: vi.fn(() => query),
    is: vi.fn(() => query),
    maybeSingle: vi.fn(resolveResponse),
    select: vi.fn(() => query),
    single: vi.fn(resolveResponse),
    update: vi.fn(() => query),
  };

  return query;
}
