import { describe, expect, it } from 'vitest';

import type { VerifiedAdminOperator } from './auth';
import {
  AdminOrderStatusError,
  buildAdminOrderStatusUpdatePayload,
} from './order-status';

const OPERATOR: VerifiedAdminOperator = {
  email: 'operator@example.com',
  id: 'operator-id',
  name: 'Operator',
  profileImage: null,
  projectRole: 'administrator',
  role: 'user',
};

describe('admin order status transitions', () => {
  it('builds a forward status update with admin history actor metadata', () => {
    expect(
      buildAdminOrderStatusUpdatePayload({
        actor: OPERATOR,
        changedAt: '2026-05-06T08:00:00.000Z',
        currentStatus: 'paid',
        nextStatus: 'shipped',
        note: 'Nadane kurierem',
        statusHistory: [
          {
            changedAt: '2026-05-06T07:00:00.000Z',
            source: 'system',
            status: 'paid',
          },
        ],
      }),
    ).toEqual({
      current_status: 'shipped',
      shipped_at: '2026-05-06T08:00:00.000Z',
      status_history: [
        {
          changedAt: '2026-05-06T07:00:00.000Z',
          source: 'system',
          status: 'paid',
        },
        {
          actorEmail: 'operator@example.com',
          actorId: 'operator-id',
          actorName: 'Operator',
          changedAt: '2026-05-06T08:00:00.000Z',
          note: 'Nadane kurierem',
          previousStatus: 'paid',
          source: 'admin',
          status: 'shipped',
        },
      ],
      updated_at: '2026-05-06T08:00:00.000Z',
    });
  });

  it('sets the matching terminal timestamp for final statuses', () => {
    expect(
      buildAdminOrderStatusUpdatePayload({
        actor: OPERATOR,
        changedAt: '2026-05-06T08:00:00.000Z',
        currentStatus: 'processing',
        nextStatus: 'cancelled',
        note: null,
        statusHistory: [],
      }),
    ).toEqual(
      expect.objectContaining({
        cancelled_at: '2026-05-06T08:00:00.000Z',
        current_status: 'cancelled',
      }),
    );
  });

  it('rejects backward, same-state, system-owned, and terminal transitions', () => {
    const baseInput = {
      actor: OPERATOR,
      changedAt: '2026-05-06T08:00:00.000Z',
      note: null,
      statusHistory: [],
    };

    expect(() =>
      buildAdminOrderStatusUpdatePayload({
        ...baseInput,
        currentStatus: 'shipped',
        nextStatus: 'processing',
      }),
    ).toThrow(AdminOrderStatusError);

    expect(() =>
      buildAdminOrderStatusUpdatePayload({
        ...baseInput,
        currentStatus: 'paid',
        nextStatus: 'paid',
      }),
    ).toThrow(AdminOrderStatusError);

    expect(() =>
      buildAdminOrderStatusUpdatePayload({
        ...baseInput,
        currentStatus: 'awaiting_payment',
        nextStatus: 'paid',
      }),
    ).toThrow(AdminOrderStatusError);

    expect(() =>
      buildAdminOrderStatusUpdatePayload({
        ...baseInput,
        currentStatus: 'returned',
        nextStatus: 'completed',
      }),
    ).toThrow(AdminOrderStatusError);
  });
});
