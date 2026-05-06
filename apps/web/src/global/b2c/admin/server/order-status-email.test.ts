import { describe, expect, it } from 'vitest';

import { getAdminOrderStatusEmailStatus } from './order-status-email';

describe('getAdminOrderStatusEmailStatus', () => {
  it('requires email for customer-facing admin statuses', () => {
    expect(getAdminOrderStatusEmailStatus('processing')).toBe('processing');
    expect(getAdminOrderStatusEmailStatus('shipped')).toBe('shipped');
    expect(getAdminOrderStatusEmailStatus('cancelled')).toBe('cancelled');
    expect(getAdminOrderStatusEmailStatus('returned')).toBe('returned');
  });

  it('does not require email for silent statuses', () => {
    expect(getAdminOrderStatusEmailStatus('completed')).toBeNull();
    expect(getAdminOrderStatusEmailStatus('paid')).toBeNull();
    expect(getAdminOrderStatusEmailStatus('awaiting_payment')).toBeNull();
  });
});
