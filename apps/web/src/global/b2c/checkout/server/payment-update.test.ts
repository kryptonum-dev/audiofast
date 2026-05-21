import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import {
  CheckoutPaymentUpdateError,
  confirmCheckoutOrderPayment,
} from './payment-update';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

function createSelectChain(
  result: Promise<{
    data: unknown;
    error: unknown;
  }>,
) {
  const singleMock = vi.fn().mockImplementation(() => result);
  const eqFirstMock = vi.fn(() => ({
    single: singleMock,
  }));

  return {
    select: vi.fn(() => ({
      eq: eqFirstMock,
    })),
    eqFirstMock,
    singleMock,
  };
}

function createUpdateChain(
  result: Promise<{
    data: unknown;
    error: unknown;
  }>,
) {
  const singleMock = vi.fn().mockImplementation(() => result);
  const selectMock = vi.fn(() => ({
    single: singleMock,
  }));
  const eqSecondMock = vi.fn(() => ({
    select: selectMock,
  }));
  const eqFirstMock = vi.fn(() => ({
    eq: eqSecondMock,
  }));

  return {
    update: vi.fn(() => ({
      eq: eqFirstMock,
    })),
    eqFirstMock,
    eqSecondMock,
    selectMock,
    singleMock,
  };
}

describe('confirmCheckoutOrderPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves an awaiting_payment order to awaiting_confirmation and appends status history', async () => {
    const initialSelectChain = createSelectChain(
      Promise.resolve({
        data: {
          created_at: '2026-04-21T09:55:00.000Z',
          id: 'order-1',
          order_number: 'AF-2026-00001',
          current_status: 'awaiting_payment',
          payable_until: '2026-04-21T10:10:00.000Z',
          payment_provider: 'przelewy24',
          status_history: [
            {
              status: 'awaiting_payment',
              changedAt: '2026-04-21T09:55:00.000Z',
              source: 'system',
            },
          ],
          payment_reference: null,
          payment_verified_at: null,
          paid_at: null,
        },
        error: null,
      }),
    );
    const updateChain = createUpdateChain(
      Promise.resolve({
        data: {
          created_at: '2026-04-21T09:55:00.000Z',
          id: 'order-1',
          order_number: 'AF-2026-00001',
          current_status: 'awaiting_confirmation',
          payable_until: '2026-04-21T10:10:00.000Z',
          payment_provider: 'przelewy24',
          status_history: [
            {
              status: 'awaiting_payment',
              changedAt: '2026-04-21T09:55:00.000Z',
              source: 'system',
            },
            {
              status: 'awaiting_confirmation',
              changedAt: '2026-04-21T10:00:00.000Z',
              source: 'system',
            },
          ],
          payment_reference: 'mock-p24-ref-af202600001',
          payment_verified_at: '2026-04-21T10:00:00.000Z',
          paid_at: '2026-04-21T10:00:00.000Z',
        },
        error: null,
      }),
    );
    const fromMock = vi.fn(() => ({
      select: initialSelectChain.select,
      update: updateChain.update,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await confirmCheckoutOrderPayment({
      orderId: 'order-1',
      paymentReference: 'mock-p24-ref-af202600001',
      verifiedAt: '2026-04-21T10:00:00.000Z',
    });

    expect(result).toMatchObject({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      currentStatus: 'awaiting_confirmation',
      paymentReference: 'mock-p24-ref-af202600001',
      paymentVerifiedAt: '2026-04-21T10:00:00.000Z',
      paidAt: '2026-04-21T10:00:00.000Z',
      wasAlreadyPaid: false,
    });
    expect(updateChain.update).toHaveBeenCalledWith({
      current_status: 'awaiting_confirmation',
      status_history: [
        {
          status: 'awaiting_payment',
          changedAt: '2026-04-21T09:55:00.000Z',
          source: 'system',
        },
        {
          status: 'awaiting_confirmation',
          changedAt: '2026-04-21T10:00:00.000Z',
          source: 'system',
        },
      ],
      payment_reference: 'mock-p24-ref-af202600001',
      payment_verified_at: '2026-04-21T10:00:00.000Z',
      paid_at: '2026-04-21T10:00:00.000Z',
      updated_at: '2026-04-21T10:00:00.000Z',
    });
  });

  it('treats an already confirmed order as an idempotent success', async () => {
    const initialSelectChain = createSelectChain(
      Promise.resolve({
        data: {
          created_at: '2026-04-21T09:55:00.000Z',
          id: 'order-1',
          order_number: 'AF-2026-00001',
          current_status: 'awaiting_confirmation',
          payable_until: '2026-04-21T10:10:00.000Z',
          payment_provider: 'przelewy24',
          status_history: [
            {
              status: 'awaiting_payment',
              changedAt: '2026-04-21T09:55:00.000Z',
              source: 'system',
            },
            {
              status: 'awaiting_confirmation',
              changedAt: '2026-04-21T10:00:00.000Z',
              source: 'system',
            },
          ],
          payment_reference: 'mock-p24-ref-af202600001',
          payment_verified_at: '2026-04-21T10:00:00.000Z',
          paid_at: '2026-04-21T10:00:00.000Z',
        },
        error: null,
      }),
    );
    const updateMock = vi.fn();
    const fromMock = vi.fn(() => ({
      select: initialSelectChain.select,
      update: updateMock,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await confirmCheckoutOrderPayment({
      orderId: 'order-1',
      paymentReference: 'mock-p24-ref-af202600001',
      verifiedAt: '2026-04-21T10:05:00.000Z',
    });

    expect(result.wasAlreadyPaid).toBe(true);
    expect(result.currentStatus).toBe('awaiting_confirmation');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects non-payable order states', async () => {
    const initialSelectChain = createSelectChain(
      Promise.resolve({
        data: {
          created_at: '2026-04-21T09:55:00.000Z',
          id: 'order-1',
          order_number: 'AF-2026-00001',
          current_status: 'cancelled',
          payable_until: '2026-04-21T10:10:00.000Z',
          payment_provider: 'przelewy24',
          status_history: [],
          payment_reference: null,
          payment_verified_at: null,
          paid_at: null,
        },
        error: null,
      }),
    );
    const fromMock = vi.fn(() => ({
      select: initialSelectChain.select,
      update: vi.fn(),
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    await expect(
      confirmCheckoutOrderPayment({
        orderId: 'order-1',
        paymentReference: 'mock-p24-ref-af202600001',
        verifiedAt: '2026-04-21T10:05:00.000Z',
      }),
    ).rejects.toBeInstanceOf(CheckoutPaymentUpdateError);
  });

  it('rejects expired unpaid orders', async () => {
    const initialSelectChain = createSelectChain(
      Promise.resolve({
        data: {
          created_at: '2026-04-21T09:55:00.000Z',
          id: 'order-1',
          order_number: 'AF-2026-00001',
          current_status: 'awaiting_payment',
          payable_until: '2026-04-21T10:00:00.000Z',
          payment_provider: 'przelewy24',
          status_history: [],
          payment_reference: null,
          payment_verified_at: null,
          paid_at: null,
        },
        error: null,
      }),
    );
    const fromMock = vi.fn(() => ({
      select: initialSelectChain.select,
      update: vi.fn(),
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    await expect(
      confirmCheckoutOrderPayment({
        orderId: 'order-1',
        paymentReference: 'mock-p24-ref-af202600001',
        verifiedAt: '2026-04-21T10:05:00.000Z',
      }),
    ).rejects.toBeInstanceOf(CheckoutPaymentUpdateError);
  });

  it('rejects orders using a different payment provider', async () => {
    const initialSelectChain = createSelectChain(
      Promise.resolve({
        data: {
          created_at: '2026-04-21T09:55:00.000Z',
          id: 'order-1',
          order_number: 'AF-2026-00001',
          current_status: 'awaiting_payment',
          payable_until: '2026-04-21T10:10:00.000Z',
          payment_provider: 'stripe',
          status_history: [],
          payment_reference: null,
          payment_verified_at: null,
          paid_at: null,
        },
        error: null,
      }),
    );
    const fromMock = vi.fn(() => ({
      select: initialSelectChain.select,
      update: vi.fn(),
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    await expect(
      confirmCheckoutOrderPayment({
        orderId: 'order-1',
        paymentReference: 'mock-p24-ref-af202600001',
        verifiedAt: '2026-04-21T10:05:00.000Z',
      }),
    ).rejects.toBeInstanceOf(CheckoutPaymentUpdateError);
  });

  it('repairs an already confirmed order when metadata is incomplete', async () => {
    const initialSelectChain = createSelectChain(
      Promise.resolve({
        data: {
          created_at: '2026-04-21T09:55:00.000Z',
          id: 'order-1',
          order_number: 'AF-2026-00001',
          current_status: 'awaiting_confirmation',
          payable_until: '2026-04-21T10:10:00.000Z',
          payment_provider: 'przelewy24',
          status_history: [],
          payment_reference: null,
          payment_verified_at: null,
          paid_at: null,
        },
        error: null,
      }),
    );
    const updateChain = createUpdateChain(
      Promise.resolve({
        data: {
          created_at: '2026-04-21T09:55:00.000Z',
          id: 'order-1',
          order_number: 'AF-2026-00001',
          current_status: 'awaiting_confirmation',
          payable_until: '2026-04-21T10:10:00.000Z',
          payment_provider: 'przelewy24',
          status_history: [
            {
              status: 'awaiting_payment',
              changedAt: '2026-04-21T09:55:00.000Z',
              source: 'system',
            },
            {
              status: 'awaiting_confirmation',
              changedAt: '2026-04-21T10:05:00.000Z',
              source: 'system',
            },
          ],
          payment_reference: 'mock-p24-ref-af202600001',
          payment_verified_at: '2026-04-21T10:05:00.000Z',
          paid_at: '2026-04-21T10:05:00.000Z',
        },
        error: null,
      }),
    );
    const fromMock = vi.fn(() => ({
      select: initialSelectChain.select,
      update: updateChain.update,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: fromMock,
    } as never);

    const result = await confirmCheckoutOrderPayment({
      orderId: 'order-1',
      paymentReference: '  mock-p24-ref-af202600001  ',
      verifiedAt: '2026-04-21T10:05:00.000Z',
    });

    expect(result.wasAlreadyPaid).toBe(true);
    expect(result.paymentReference).toBe('mock-p24-ref-af202600001');
    expect(updateChain.update).toHaveBeenCalledWith({
      status_history: [
        {
          status: 'awaiting_payment',
          changedAt: '2026-04-21T09:55:00.000Z',
          source: 'system',
        },
        {
          status: 'awaiting_confirmation',
          changedAt: '2026-04-21T10:05:00.000Z',
          source: 'system',
        },
      ],
      payment_reference: 'mock-p24-ref-af202600001',
      payment_verified_at: '2026-04-21T10:05:00.000Z',
      paid_at: '2026-04-21T10:05:00.000Z',
      updated_at: '2026-04-21T10:05:00.000Z',
    });
  });
});
