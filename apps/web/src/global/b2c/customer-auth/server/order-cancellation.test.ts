import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import { requestCustomerOrderCancellation } from './order-cancellation';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const BASE_ORDER_ROW = {
  current_status: 'paid',
  customer_email: 'jan@example.com',
  id: 'order-1',
  order_number: 'AF-2026-00001',
};

const BASE_REQUEST_ROW = {
  customer_message: 'Please cancel it.',
  id: 'request-1',
  reason: 'changed_mind',
  requested_at: '2026-04-28T07:00:00.000Z',
  status: 'open',
};

function setupSupabaseMock(args: {
  orderRow?: unknown;
  openRequestRow?: unknown;
  insertRow?: unknown;
}) {
  const orderMaybeSingleMock = vi.fn().mockResolvedValue({
    data: args.orderRow === undefined ? BASE_ORDER_ROW : args.orderRow,
    error: null,
  });
  const orderIlikeMock = vi.fn(() => ({
    maybeSingle: orderMaybeSingleMock,
  }));
  const orderEqMock = vi.fn(() => ({
    ilike: orderIlikeMock,
  }));
  const ordersSelectMock = vi.fn(() => ({
    eq: orderEqMock,
  }));

  const requestMaybeSingleMock = vi.fn().mockResolvedValue({
    data: args.openRequestRow ?? null,
    error: null,
  });
  const requestStatusEqMock = vi.fn(() => ({
    maybeSingle: requestMaybeSingleMock,
  }));
  const requestOrderEqMock = vi.fn(() => ({
    eq: requestStatusEqMock,
  }));
  const requestsSelectMock = vi.fn(() => ({
    eq: requestOrderEqMock,
  }));

  const insertSingleMock = vi.fn().mockResolvedValue({
    data: args.insertRow ?? BASE_REQUEST_ROW,
    error: null,
  });
  const insertSelectMock = vi.fn(() => ({
    single: insertSingleMock,
  }));
  const insertMock = vi.fn(() => ({
    select: insertSelectMock,
  }));

  const fromMock = vi.fn((table: string) => {
    if (table === 'orders') {
      return { select: ordersSelectMock };
    }

    if (table === 'order_cancellation_requests') {
      return {
        insert: insertMock,
        select: requestsSelectMock,
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  vi.mocked(createAdminClient).mockReturnValue({
    from: fromMock,
  } as never);

  return {
    insertMock,
    orderEqMock,
    orderIlikeMock,
    requestMaybeSingleMock,
  };
}

describe('requestCustomerOrderCancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an open cancellation request for an owned paid order', async () => {
    const mocks = setupSupabaseMock({});

    const result = await requestCustomerOrderCancellation({
      customerMessage: ' Please cancel it. ',
      normalizedEmail: 'jan@example.com',
      now: new Date('2026-04-28T07:00:00.000Z'),
      orderNumber: 'AF-2026-00001',
      reason: ' changed_mind ',
    });

    expect(result).toEqual({
      kind: 'created',
      request: {
        customerMessage: 'Please cancel it.',
        id: 'request-1',
        reason: 'changed_mind',
        requestedAt: '2026-04-28T07:00:00.000Z',
        status: 'open',
      },
    });
    expect(mocks.orderEqMock).toHaveBeenCalledWith(
      'order_number',
      'AF-2026-00001',
    );
    expect(mocks.orderIlikeMock).toHaveBeenCalledWith(
      'customer_email',
      'jan@example.com',
    );
    expect(mocks.insertMock).toHaveBeenCalledWith({
      customer_email: 'jan@example.com',
      customer_message: 'Please cancel it.',
      order_id: 'order-1',
      reason: 'changed_mind',
      requested_at: '2026-04-28T07:00:00.000Z',
      status: 'open',
      updated_at: '2026-04-28T07:00:00.000Z',
    });
  });

  it('creates an open cancellation request for an owned processing order', async () => {
    const mocks = setupSupabaseMock({
      insertRow: {
        ...BASE_REQUEST_ROW,
        customer_message: null,
        reason: null,
      },
      orderRow: {
        ...BASE_ORDER_ROW,
        current_status: 'processing',
      },
    });

    const result = await requestCustomerOrderCancellation({
      normalizedEmail: 'jan@example.com',
      now: new Date('2026-04-28T07:00:00.000Z'),
      orderNumber: 'AF-2026-00001',
    });

    expect(result).toEqual({
      kind: 'created',
      request: {
        customerMessage: null,
        id: 'request-1',
        reason: null,
        requestedAt: '2026-04-28T07:00:00.000Z',
        status: 'open',
      },
    });
    expect(mocks.insertMock).toHaveBeenCalledWith({
      customer_email: 'jan@example.com',
      customer_message: null,
      order_id: 'order-1',
      reason: null,
      requested_at: '2026-04-28T07:00:00.000Z',
      status: 'open',
      updated_at: '2026-04-28T07:00:00.000Z',
    });
  });

  it('returns already requested when an open request exists', async () => {
    const mocks = setupSupabaseMock({
      openRequestRow: BASE_REQUEST_ROW,
    });

    const result = await requestCustomerOrderCancellation({
      normalizedEmail: 'jan@example.com',
      orderNumber: 'AF-2026-00001',
    });

    expect(result).toEqual({
      kind: 'already_requested',
      request: {
        customerMessage: 'Please cancel it.',
        id: 'request-1',
        reason: 'changed_mind',
        requestedAt: '2026-04-28T07:00:00.000Z',
        status: 'open',
      },
    });
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('rejects an ineligible shipped order', async () => {
    const mocks = setupSupabaseMock({
      orderRow: {
        ...BASE_ORDER_ROW,
        current_status: 'shipped',
      },
    });

    const result = await requestCustomerOrderCancellation({
      normalizedEmail: 'jan@example.com',
      orderNumber: 'AF-2026-00001',
    });

    expect(result).toEqual({
      kind: 'not_eligible',
      currentStatus: 'shipped',
    });
    expect(mocks.requestMaybeSingleMock).not.toHaveBeenCalled();
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('returns not found when the order is not owned by the customer', async () => {
    const mocks = setupSupabaseMock({
      orderRow: null,
    });

    const result = await requestCustomerOrderCancellation({
      normalizedEmail: 'ewa@example.com',
      orderNumber: 'AF-2026-00001',
    });

    expect(result).toEqual({ kind: 'not_found' });
    expect(mocks.requestMaybeSingleMock).not.toHaveBeenCalled();
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });
});
