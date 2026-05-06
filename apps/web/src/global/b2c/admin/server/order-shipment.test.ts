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
          trackingNumber: ' TRACK123 ',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
        previousShipmentData: null,
        previousShippedAt: null,
      }),
    ).toEqual({
      shipment_data: {
        carrier: null,
        shippedAt: null,
        trackingNumber: 'TRACK123',
        trackingUrl:
          'https://www.apaczka.pl/sledz-przesylke/?trackingNumber=TRACK123',
      },
      shipped_at: null,
      updated_at: '2026-05-06T09:00:00.000Z',
    });
  });

  it('preserves an existing shipped timestamp when the payload omits it', () => {
    expect(
      buildAdminOrderShipmentPayload({
        input: {
          trackingNumber: 'ABC',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
        previousShipmentData: null,
        previousShippedAt: '2026-05-05T08:00:00.000Z',
      }),
    ).toEqual(
      expect.objectContaining({
        shipment_data: {
          carrier: null,
          shippedAt: '2026-05-05T08:00:00.000Z',
          trackingNumber: 'ABC',
          trackingUrl:
            'https://www.apaczka.pl/sledz-przesylke/?trackingNumber=ABC',
        },
        shipped_at: '2026-05-05T08:00:00.000Z',
      }),
    );
  });

  it('stores an optional carrier when provided', () => {
    expect(
      buildAdminOrderShipmentPayload({
        input: {
          carrier: ' DHL ',
          trackingNumber: ' TRACK123 ',
        },
        now: new Date('2026-05-06T09:00:00.000Z'),
        previousShipmentData: null,
        previousShippedAt: null,
      }),
    ).toEqual(
      expect.objectContaining({
        shipment_data: expect.objectContaining({
          carrier: 'DHL',
          trackingNumber: 'TRACK123',
        }),
      }),
    );
  });

  it('rejects incomplete or invalid shipment payloads', () => {
    expect(() =>
      buildAdminOrderShipmentPayload({
        input: {
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
