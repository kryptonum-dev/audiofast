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
        currentStatus: 'processing',
        nextStatus: 'shipped',
        note: 'Nadane kurierem',
        shippedAt: null,
        statusHistory: [
          {
            changedAt: '2026-05-06T07:00:00.000Z',
            source: 'system',
            status: 'processing',
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
          status: 'processing',
        },
        {
          actorEmail: 'operator@example.com',
          actorId: 'operator-id',
          actorImage: null,
          actorName: 'Operator',
          changedAt: '2026-05-06T08:00:00.000Z',
          note: 'Nadane kurierem',
          previousStatus: 'processing',
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

  it('can save a delivery estimate with the status transition', () => {
    expect(
      buildAdminOrderStatusUpdatePayload({
        actor: OPERATOR,
        changedAt: '2026-05-06T08:00:00.000Z',
        currentStatus: 'awaiting_confirmation',
        deliveryEstimate: {
          expectedDeliveryFrom: '2026-05-20',
          expectedDeliveryTo: '2026-05-27',
        },
        nextStatus: 'processing',
        note: null,
        shippedAt: null,
        statusHistory: [],
      }),
    ).toEqual(
      expect.objectContaining({
        current_status: 'processing',
        expected_delivery_from: '2026-05-20',
        expected_delivery_to: '2026-05-27',
        updated_at: '2026-05-06T08:00:00.000Z',
      }),
    );
  });

  it('can update the delivery estimate when marking an order as shipped', () => {
    expect(
      buildAdminOrderStatusUpdatePayload({
        actor: OPERATOR,
        changedAt: '2026-05-06T08:00:00.000Z',
        currentStatus: 'processing',
        deliveryEstimate: {
          expectedDeliveryFrom: '2026-05-22',
          expectedDeliveryTo: '2026-05-24',
        },
        nextStatus: 'shipped',
        note: 'Nadane kurierem',
        shippedAt: null,
        statusHistory: [],
      }),
    ).toEqual(
      expect.objectContaining({
        current_status: 'shipped',
        expected_delivery_from: '2026-05-22',
        expected_delivery_to: '2026-05-24',
        shipped_at: '2026-05-06T08:00:00.000Z',
        updated_at: '2026-05-06T08:00:00.000Z',
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
