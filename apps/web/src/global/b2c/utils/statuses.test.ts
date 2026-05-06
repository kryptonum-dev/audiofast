import { describe, expect, it } from 'vitest';

import {
  getAdminAllowedNextOrderStatuses,
  getReturnDeadline,
  isB2cOrderStatus,
  isCancellableOrderStatus,
  isReturnEligibleOrderStatus,
  isWithinReturnWindow,
} from './statuses';

describe('B2C status utilities', () => {
  it('recognizes accepted order statuses', () => {
    expect(isB2cOrderStatus('paid')).toBe(true);
    expect(isB2cOrderStatus('processing')).toBe(true);
    expect(isB2cOrderStatus('unknown')).toBe(false);
  });

  it('returns admin forward transitions', () => {
    expect(getAdminAllowedNextOrderStatuses('paid')).toEqual([
      'processing',
      'shipped',
      'completed',
      'cancelled',
    ]);
    expect(getAdminAllowedNextOrderStatuses('shipped')).toEqual([
      'completed',
      'returned',
    ]);
    expect(getAdminAllowedNextOrderStatuses('awaiting_payment')).toEqual([]);
    expect(getAdminAllowedNextOrderStatuses('returned')).toEqual([]);
  });

  it('checks cancellation and return eligible statuses', () => {
    expect(isCancellableOrderStatus('paid')).toBe(true);
    expect(isCancellableOrderStatus('processing')).toBe(true);
    expect(isCancellableOrderStatus('shipped')).toBe(false);

    expect(isReturnEligibleOrderStatus('shipped')).toBe(true);
    expect(isReturnEligibleOrderStatus('completed')).toBe(true);
    expect(isReturnEligibleOrderStatus('processing')).toBe(false);
  });

  it('checks return window deadlines', () => {
    expect(getReturnDeadline(null)).toBeNaN();
    expect(
      isWithinReturnWindow({
        now: new Date('2026-05-10T08:00:00.000Z'),
        shippedAt: '2026-05-01T08:00:00.000Z',
      }),
    ).toBe(true);
    expect(
      isWithinReturnWindow({
        now: new Date('2026-05-20T08:00:00.000Z'),
        shippedAt: '2026-05-01T08:00:00.000Z',
      }),
    ).toBe(false);
  });
});
