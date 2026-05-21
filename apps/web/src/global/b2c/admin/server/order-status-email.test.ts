import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAdminOrderStatusEmailStatus } from '../order-status-email-content';
import { sendAdminOrderStatusUpdateEmail } from './order-status-email';

vi.mock('@/src/global/email/service', () => ({
  getTransactionalReplyToEmail: vi.fn(() => 'sklep@example.com'),
  sendTransactionalEmail: vi.fn(),
}));

const { sendTransactionalEmail } = await import('@/src/global/email/service');

describe('getAdminOrderStatusEmailStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires email for customer-facing admin statuses', () => {
    expect(getAdminOrderStatusEmailStatus('processing')).toBe('processing');
    expect(getAdminOrderStatusEmailStatus('shipped')).toBe('shipped');
    expect(getAdminOrderStatusEmailStatus('cancelled')).toBe('cancelled');
    expect(getAdminOrderStatusEmailStatus('returned')).toBe('returned');
  });

  it('does not require email for silent statuses', () => {
    expect(getAdminOrderStatusEmailStatus('completed')).toBeNull();
    expect(getAdminOrderStatusEmailStatus('awaiting_confirmation')).toBeNull();
    expect(getAdminOrderStatusEmailStatus('paid')).toBeNull();
    expect(getAdminOrderStatusEmailStatus('awaiting_payment')).toBeNull();
  });

  it('passes an expected delivery estimate into processing emails', async () => {
    await sendAdminOrderStatusUpdateEmail({
      order: {
        customer_email: 'jan@example.com',
        customer_snapshot: {
          firstName: 'Jan',
        },
        expected_delivery_from: '2026-05-20',
        expected_delivery_to: '2026-05-27',
        order_number: 'AF-2026-00001',
        shipment_data: null,
        shipped_at: null,
      },
      status: 'processing',
    });

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        react: expect.objectContaining({
          props: expect.objectContaining({
            deliveryEstimateLabel: '20-27 maja 2026',
          }),
        }),
      }),
    );
  });
});
