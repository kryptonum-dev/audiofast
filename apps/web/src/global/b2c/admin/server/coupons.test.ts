import { describe, expect, it } from 'vitest';

import { AdminCouponError, adminCouponTesting } from './coupons';

const BASE_COUPON = {
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
});
