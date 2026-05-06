import { describe, expect, it } from 'vitest';

import {
  AdminOrderCaseError,
  getAdminReturnIneligibilityReason,
} from './order-cases';

describe('admin order case helpers', () => {
  const baseOrder = {
    current_status: 'shipped',
    invoice_data: {
      recipientType: 'private',
    },
    shipped_at: '2026-05-01T08:00:00.000Z',
  };

  it('accepts a shipped returnable order in the return window', () => {
    expect(
      getAdminReturnIneligibilityReason({
        hasOpenReturnCase: false,
        itemRows: [{ is_returnable: true }],
        now: new Date('2026-05-06T08:00:00.000Z'),
        order: baseOrder,
      }),
    ).toBeNull();
  });

  it('explains return ineligibility reasons', () => {
    expect(
      getAdminReturnIneligibilityReason({
        hasOpenReturnCase: false,
        itemRows: [{ is_returnable: true }],
        now: new Date('2026-05-06T08:00:00.000Z'),
        order: {
          ...baseOrder,
          current_status: 'processing',
        },
      }),
    ).toBe('status');

    expect(
      getAdminReturnIneligibilityReason({
        hasOpenReturnCase: false,
        itemRows: [{ is_returnable: false }],
        now: new Date('2026-05-06T08:00:00.000Z'),
        order: baseOrder,
      }),
    ).toBe('non_returnable_item');

    expect(
      getAdminReturnIneligibilityReason({
        hasOpenReturnCase: false,
        itemRows: [{ is_returnable: true }],
        now: new Date('2026-05-06T08:00:00.000Z'),
        order: {
          ...baseOrder,
          invoice_data: {
            recipientType: 'company',
          },
        },
      }),
    ).toBe('company_invoice');

    expect(
      getAdminReturnIneligibilityReason({
        hasOpenReturnCase: false,
        itemRows: [{ is_returnable: true }],
        now: new Date('2026-05-20T08:00:00.000Z'),
        order: baseOrder,
      }),
    ).toBe('return_window_expired');

    expect(
      getAdminReturnIneligibilityReason({
        hasOpenReturnCase: true,
        itemRows: [{ is_returnable: true }],
        now: new Date('2026-05-06T08:00:00.000Z'),
        order: baseOrder,
      }),
    ).toBe('open_return_case');
  });

  it('uses typed admin case errors for route handling', () => {
    const error = new AdminOrderCaseError(
      'Cannot resolve request.',
      'case_not_open',
      409,
    );

    expect(error.code).toBe('case_not_open');
    expect(error.status).toBe(409);
  });
});
