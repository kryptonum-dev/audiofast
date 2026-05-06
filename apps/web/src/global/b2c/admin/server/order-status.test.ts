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
        shippedAt: null,
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
          actorImage: null,
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
        shippedAt: null,
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
        shippedAt: '2026-05-01T08:00:00.000Z',
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

  it('rejects manual return transitions after the return window expires', () => {
    expect(() =>
      buildAdminOrderStatusUpdatePayload({
        actor: OPERATOR,
        changedAt: '2026-05-20T08:00:00.000Z',
        currentStatus: 'completed',
        nextStatus: 'returned',
        note: null,
        shippedAt: '2026-05-01T08:00:00.000Z',
        statusHistory: [],
      }),
    ).toThrow(AdminOrderStatusError);
  });
});
