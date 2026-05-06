import { describe, expect, it } from 'vitest';

import {
  AdminOrderShipmentError,
  buildAdminOrderShipmentPayload,
} from './order-shipment';

describe('admin order shipment helpers', () => {
  it('builds a normalized shipment payload without changing order status', () => {
    expect(
      buildAdminOrderShipmentPayload({
        input: {
          carrier: ' DHL ',
          shippedAt: '2026-05-06T08:00:00.000Z',
          trackingNumber: ' TRACK123 ',
          trackingUrl: 'https://tracking.example.com/parcel/TRACK123',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
        previousShipmentData: null,
        previousShippedAt: null,
      }),
    ).toEqual({
      shipment_data: {
        carrier: 'DHL',
        shippedAt: '2026-05-06T08:00:00.000Z',
        trackingNumber: 'TRACK123',
        trackingUrl: 'https://tracking.example.com/parcel/TRACK123',
      },
      shipped_at: '2026-05-06T08:00:00.000Z',
      updated_at: '2026-05-06T09:00:00.000Z',
    });
  });

  it('preserves an existing shipped timestamp when the payload omits it', () => {
    expect(
      buildAdminOrderShipmentPayload({
        input: {
          carrier: 'InPost',
          trackingNumber: 'ABC',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
        previousShipmentData: null,
        previousShippedAt: '2026-05-05T08:00:00.000Z',
      }),
    ).toEqual(
      expect.objectContaining({
        shipment_data: {
          carrier: 'InPost',
          shippedAt: '2026-05-05T08:00:00.000Z',
          trackingNumber: 'ABC',
          trackingUrl: null,
        },
        shipped_at: '2026-05-05T08:00:00.000Z',
      }),
    );
  });

  it('rejects incomplete or invalid shipment payloads', () => {
    expect(() =>
      buildAdminOrderShipmentPayload({
        input: {
          carrier: 'DHL',
          trackingNumber: '',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
        previousShipmentData: null,
        previousShippedAt: null,
      }),
    ).toThrow(AdminOrderShipmentError);

    expect(() =>
      buildAdminOrderShipmentPayload({
        input: {
          carrier: 'DHL',
          shippedAt: 'not-a-date',
          trackingNumber: 'TRACK123',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
        previousShipmentData: null,
        previousShippedAt: null,
      }),
    ).toThrow(AdminOrderShipmentError);
  });
});
