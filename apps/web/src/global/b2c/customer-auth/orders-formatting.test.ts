import { describe, expect, it } from 'vitest';

import {
  getCustomerOrderStatusLabel,
  getCustomerOrderStatusTone,
  getCustomerPaymentStatusLabel,
  getCustomerTimelineStatusLabel,
} from './orders-formatting';

describe('customer order formatting', () => {
  it('formats awaiting confirmation as the visible order status', () => {
    const order = {
      accessKind: 'customer_visible' as const,
      currentStatus: 'awaiting_confirmation',
    };

    expect(getCustomerOrderStatusLabel(order)).toBe(
      'Oczekiwanie na potwierdzenie',
    );
    expect(getCustomerOrderStatusTone(order)).toBe('success');
  });

  it('formats payment status from payment timestamps', () => {
    expect(
      getCustomerPaymentStatusLabel({
        accessKind: 'customer_visible',
        currentStatus: 'awaiting_confirmation',
        paidAt: '2026-05-21T05:00:00.000Z',
      }),
    ).toBe('Opłacone');
    expect(
      getCustomerPaymentStatusLabel({
        accessKind: 'awaiting_payment_active',
        currentStatus: 'awaiting_payment',
        paidAt: null,
      }),
    ).toBe('Oczekuje na płatność');
  });

  it('keeps timeline payment milestones distinct from order lifecycle status', () => {
    expect(getCustomerTimelineStatusLabel('paid')).toBe('Opłacone');
    expect(getCustomerTimelineStatusLabel('awaiting_confirmation')).toBe(
      'Oczekiwanie na potwierdzenie',
    );
  });
});
