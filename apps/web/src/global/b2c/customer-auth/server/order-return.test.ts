import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import { requestCustomerOrderReturn } from './order-return';

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const BASE_ORDER_ROW = {
  current_status: 'shipped',
  customer_email: 'jan@example.com',
  id: 'order-1',
  invoice_data: {
    recipientType: 'private',
  },
  order_number: 'AF-2026-00001',
  shipped_at: '2026-04-20T07:00:00.000Z',
};

const BASE_RETURN_CASE_ROW = {
  created_at: '2026-04-28T07:00:00.000Z',
  id: 'return-case-1',
  reason: 'changed_mind',
  status: 'open',
};

function setupSupabaseMock(args: {
  orderRow?: unknown;
  openReturnCaseRow?: unknown;
  itemRows?: unknown[];
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

  const returnCaseMaybeSingleMock = vi.fn().mockResolvedValue({
    data: args.openReturnCaseRow ?? null,
    error: null,
  });
  const returnCaseStatusEqMock = vi.fn(() => ({
    maybeSingle: returnCaseMaybeSingleMock,
  }));
  const returnCaseOrderEqMock = vi.fn(() => ({
    eq: returnCaseStatusEqMock,
  }));
  const returnCasesSelectMock = vi.fn(() => ({
    eq: returnCaseOrderEqMock,
  }));

  const itemRows = args.itemRows ?? [{ is_returnable: true }];
  const orderItemsEqMock = vi.fn().mockResolvedValue({
    data: itemRows,
    error: null,
  });
  const orderItemsSelectMock = vi.fn(() => ({
    eq: orderItemsEqMock,
  }));

  const insertSingleMock = vi.fn().mockResolvedValue({
    data: args.insertRow ?? BASE_RETURN_CASE_ROW,
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

    if (table === 'order_items') {
      return { select: orderItemsSelectMock };
    }

    if (table === 'return_cases') {
      return {
        insert: insertMock,
        select: returnCasesSelectMock,
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
    returnCaseMaybeSingleMock,
  };
}

describe('requestCustomerOrderReturn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an open return case for an owned shipped order', async () => {
    const mocks = setupSupabaseMock({});

    const result = await requestCustomerOrderReturn({
      normalizedEmail: 'jan@example.com',
      now: new Date('2026-04-28T07:00:00.000Z'),
      orderNumber: 'AF-2026-00001',
      reason: ' changed_mind ',
    });

    expect(result).toEqual({
      kind: 'created',
      returnCase: {
        createdAt: '2026-04-28T07:00:00.000Z',
        id: 'return-case-1',
        reason: 'changed_mind',
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
      created_at: '2026-04-28T07:00:00.000Z',
      order_id: 'order-1',
      reason: 'changed_mind',
      status: 'open',
      updated_at: '2026-04-28T07:00:00.000Z',
    });
  });

  it('creates an open return case for an owned completed order', async () => {
    const mocks = setupSupabaseMock({
      insertRow: {
        ...BASE_RETURN_CASE_ROW,
        reason: null,
      },
      orderRow: {
        ...BASE_ORDER_ROW,
        current_status: 'completed',
      },
    });

    const result = await requestCustomerOrderReturn({
      normalizedEmail: 'jan@example.com',
      now: new Date('2026-04-28T07:00:00.000Z'),
      orderNumber: 'AF-2026-00001',
    });

    expect(result).toEqual({
      kind: 'created',
      returnCase: {
        createdAt: '2026-04-28T07:00:00.000Z',
        id: 'return-case-1',
        reason: null,
        status: 'open',
      },
    });
    expect(mocks.insertMock).toHaveBeenCalledWith({
      created_at: '2026-04-28T07:00:00.000Z',
      order_id: 'order-1',
      reason: null,
      status: 'open',
      updated_at: '2026-04-28T07:00:00.000Z',
    });
  });

  it('allows creating a return case without a reason', async () => {
    const mocks = setupSupabaseMock({
      insertRow: {
        ...BASE_RETURN_CASE_ROW,
        reason: null,
      },
    });

    const result = await requestCustomerOrderReturn({
      normalizedEmail: 'jan@example.com',
      now: new Date('2026-04-28T07:00:00.000Z'),
      orderNumber: 'AF-2026-00001',
      reason: '   ',
    });

    expect(result).toEqual({
      kind: 'created',
      returnCase: {
        createdAt: '2026-04-28T07:00:00.000Z',
        id: 'return-case-1',
        reason: null,
        status: 'open',
      },
    });
    expect(mocks.insertMock).toHaveBeenCalledWith({
      created_at: '2026-04-28T07:00:00.000Z',
      order_id: 'order-1',
      reason: null,
      status: 'open',
      updated_at: '2026-04-28T07:00:00.000Z',
    });
  });

  it('returns already requested when an open return case exists', async () => {
    const mocks = setupSupabaseMock({
      openReturnCaseRow: BASE_RETURN_CASE_ROW,
    });

    const result = await requestCustomerOrderReturn({
      normalizedEmail: 'jan@example.com',
      orderNumber: 'AF-2026-00001',
    });

    expect(result).toEqual({
      kind: 'already_requested',
      returnCase: {
        createdAt: '2026-04-28T07:00:00.000Z',
        id: 'return-case-1',
        reason: 'changed_mind',
        status: 'open',
      },
    });
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('returns not found when the order is not owned by the customer', async () => {
    const mocks = setupSupabaseMock({
      orderRow: null,
    });

    const result = await requestCustomerOrderReturn({
      normalizedEmail: 'ewa@example.com',
      orderNumber: 'AF-2026-00001',
    });

    expect(result).toEqual({ kind: 'not_found' });
    expect(mocks.returnCaseMaybeSingleMock).not.toHaveBeenCalled();
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('rejects orders that are not shipped or completed', async () => {
    const mocks = setupSupabaseMock({
      orderRow: {
        ...BASE_ORDER_ROW,
        current_status: 'paid',
      },
    });

    const result = await requestCustomerOrderReturn({
      normalizedEmail: 'jan@example.com',
      orderNumber: 'AF-2026-00001',
    });

    expect(result).toEqual({
      currentStatus: 'paid',
      kind: 'not_eligible',
      reason: 'status',
    });
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('rejects orders with a non-returnable item', async () => {
    const mocks = setupSupabaseMock({
      itemRows: [{ is_returnable: true }, { is_returnable: false }],
    });

    const result = await requestCustomerOrderReturn({
      normalizedEmail: 'jan@example.com',
      orderNumber: 'AF-2026-00001',
    });

    expect(result).toEqual({
      currentStatus: 'shipped',
      kind: 'not_eligible',
      reason: 'non_returnable_item',
    });
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('rejects self-service returns for company invoices', async () => {
    const mocks = setupSupabaseMock({
      orderRow: {
        ...BASE_ORDER_ROW,
        invoice_data: {
          recipientType: 'company',
        },
      },
    });

    const result = await requestCustomerOrderReturn({
      normalizedEmail: 'jan@example.com',
      orderNumber: 'AF-2026-00001',
    });

    expect(result).toEqual({
      currentStatus: 'shipped',
      kind: 'not_eligible',
      reason: 'company_invoice',
    });
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it('rejects orders outside the 14-day return window', async () => {
    const mocks = setupSupabaseMock({});

    const result = await requestCustomerOrderReturn({
      normalizedEmail: 'jan@example.com',
      now: new Date('2026-05-10T07:00:00.000Z'),
      orderNumber: 'AF-2026-00001',
    });

    expect(result).toEqual({
      currentStatus: 'shipped',
      kind: 'not_eligible',
      reason: 'return_window_expired',
    });
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });
});
