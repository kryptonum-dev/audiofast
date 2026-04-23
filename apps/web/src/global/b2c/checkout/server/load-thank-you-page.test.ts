import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import { loadThankYouPageData } from './load-thank-you-page';
import { handleCheckoutPaymentStatusNotification } from './payment-status';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('./payment-status', () => ({
  handleCheckoutPaymentStatusNotification: vi.fn(),
}));

const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({
  maybeSingle: maybeSingleMock,
}));
const selectMock = vi.fn(() => ({
  eq: eqMock,
}));
const fromMock = vi.fn(() => ({
  select: selectMock,
}));

describe('loadThankYouPageData', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);
  });

  it('returns invalid_access when the order number is missing', async () => {
    const result = await loadThankYouPageData({});

    expect(result.orderNumber).toBeNull();
    expect(result.mockScenarioId).toBeNull();
    expect(result.state.id).toBe('invalid_access');
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('loads an unpaid order and resolves the awaiting_payment state', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_number: 'AF-2026-00001',
        current_status: 'awaiting_payment',
        payable_until: '2026-04-23T10:15:00.000Z',
      },
      error: null,
    });

    const result = await loadThankYouPageData({
      order: 'AF-2026-00001',
    });

    expect(result.orderNumber).toBe('AF-2026-00001');
    expect(result.mockScenarioId).toBeNull();
    expect(result.state.id).toBe('awaiting_payment');
    expect(result.state.shouldPoll).toBe(true);
  });

  it('loads a paid order and resolves the paid state', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_number: 'AF-2026-00001',
        current_status: 'paid',
        payable_until: '2026-04-23T10:15:00.000Z',
      },
      error: null,
    });

    const result = await loadThankYouPageData({
      order: 'AF-2026-00001',
    });

    expect(result.state.id).toBe('paid');
    expect(result.state.shouldPoll).toBe(false);
  });

  it('falls back to invalid_access when the order cannot be found', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await loadThankYouPageData({
      order: 'AF-2026-99999',
    });

    expect(result.orderNumber).toBe('AF-2026-99999');
    expect(result.state.id).toBe('invalid_access');
  });

  it('advances delayed success scenarios on explicit refresh and then resolves paid', async () => {
    maybeSingleMock
      .mockResolvedValueOnce({
        data: {
          id: 'order-1',
          order_number: 'AF-2026-00001',
          current_status: 'awaiting_payment',
          payable_until: '2026-04-23T10:15:00.000Z',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'order-1',
          order_number: 'AF-2026-00001',
          current_status: 'paid',
          payable_until: '2026-04-23T10:15:00.000Z',
        },
        error: null,
      });
    vi.mocked(handleCheckoutPaymentStatusNotification).mockResolvedValueOnce({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      providerStatus: 'done',
      currentStatus: 'paid',
      wasConfirmed: true,
      wasAlreadyPaid: false,
    });

    const result = await loadThankYouPageData({
      order: 'AF-2026-00001',
      scenario: 'success_return_before_status',
      refresh: '1',
    });

    expect(handleCheckoutPaymentStatusNotification).toHaveBeenCalledTimes(1);
    expect(result.mockScenarioId).toBe('success_return_before_status');
    expect(result.state.id).toBe('paid');
  });
});
