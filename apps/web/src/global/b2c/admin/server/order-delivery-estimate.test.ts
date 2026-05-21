import { describe, expect, it } from 'vitest';

import {
  AdminOrderDeliveryEstimateError,
  buildAdminOrderDeliveryEstimatePayload,
} from './order-delivery-estimate';

describe('admin order delivery estimate helpers', () => {
  it('builds a normalized delivery estimate payload for a single date', () => {
    expect(
      buildAdminOrderDeliveryEstimatePayload({
        input: {
          expectedDeliveryFrom: ' 2026-05-20 ',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
      }),
    ).toEqual({
      expected_delivery_from: '2026-05-20',
      expected_delivery_to: null,
      updated_at: '2026-05-06T09:00:00.000Z',
    });
  });

  it('builds a normalized delivery estimate payload for a range', () => {
    expect(
      buildAdminOrderDeliveryEstimatePayload({
        input: {
          expectedDeliveryFrom: '2026-05-20',
          expectedDeliveryTo: '2026-05-27',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
      }),
    ).toEqual({
      expected_delivery_from: '2026-05-20',
      expected_delivery_to: '2026-05-27',
      updated_at: '2026-05-06T09:00:00.000Z',
    });
  });

  it('clears the delivery estimate when both fields are empty', () => {
    expect(
      buildAdminOrderDeliveryEstimatePayload({
        input: {
          expectedDeliveryFrom: '',
          expectedDeliveryTo: null,
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
      }),
    ).toEqual({
      expected_delivery_from: null,
      expected_delivery_to: null,
      updated_at: '2026-05-06T09:00:00.000Z',
    });
  });

  it('rejects invalid delivery estimate payloads', () => {
    expect(() =>
      buildAdminOrderDeliveryEstimatePayload({
        input: {
          expectedDeliveryFrom: '2026-02-31',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
      }),
    ).toThrow(AdminOrderDeliveryEstimateError);

    expect(() =>
      buildAdminOrderDeliveryEstimatePayload({
        input: {
          expectedDeliveryTo: '2026-05-27',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
      }),
    ).toThrow(AdminOrderDeliveryEstimateError);

    expect(() =>
      buildAdminOrderDeliveryEstimatePayload({
        input: {
          expectedDeliveryFrom: '2026-05-20',
          expectedDeliveryTo: '2026-05-19',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
      }),
    ).toThrow(AdminOrderDeliveryEstimateError);
  });
});
