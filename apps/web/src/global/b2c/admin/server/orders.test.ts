import { describe, expect, it } from 'vitest';

import { AdminOrderQueryError, adminOrderTesting } from './orders';

describe('admin order helpers', () => {
  it('parses order list filters from search params', () => {
    expect(
      adminOrderTesting.parseAdminOrderListFilters(
        new URLSearchParams(
          'q=AF-2026&status=paid,processing&lineType=mixed&hasInvoice=true&hasShipment=0&includeExpiredAwaitingPayment=1',
        ),
      ),
    ).toEqual({
      q: 'AF-2026',
      statuses: ['paid', 'processing'],
      lineType: 'mixed',
      hasInvoice: true,
      hasShipment: false,
      hasOpenCancellationRequest: null,
      hasOpenReturnCase: null,
      createdFrom: null,
      createdTo: null,
      includeExpiredAwaitingPayment: true,
    });
  });

  it('rejects unknown order list filters', () => {
    expect(() =>
      adminOrderTesting.parseAdminOrderListFilters(
        new URLSearchParams('status=unknown'),
      ),
    ).toThrow(AdminOrderQueryError);

    expect(() =>
      adminOrderTesting.parseAdminOrderListFilters(
        new URLSearchParams('lineType=unknown'),
      ),
    ).toThrow(AdminOrderQueryError);
  });

  it('matches customer names from snapshots for admin search', () => {
    expect(
      adminOrderTesting.customerSnapshotMatchesName(
        {
          firstName: 'Łukasz',
          lastName: 'Kamiński',
        },
        'lukasz kaminski',
      ),
    ).toBe(true);
    expect(
      adminOrderTesting.customerSnapshotMatchesName(
        {
          first_name: 'Anna',
          last_name: 'Nowak',
        },
        'nowak',
      ),
    ).toBe(true);
    expect(
      adminOrderTesting.customerSnapshotMatchesName(
        {
          firstName: 'Piotr',
          lastName: 'Wiśniewski',
        },
        'zielinska',
      ),
    ).toBe(false);
  });

  it('maps order list rows into narrow admin DTOs', () => {
    const order = adminOrderTesting.mapAdminOrderListRow({
      created_at: '2026-05-06T08:00:00.000Z',
      current_status: 'paid',
      customer_email: 'customer@example.com',
      customer_snapshot: {
        email: 'customer@example.com',
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '+48123456789',
      },
      discount_total_cents: 1000,
      grand_total_cents: 9900,
      id: 'order-id',
      invoice_data: {
        attachedAt: '2026-05-06T09:00:00.000Z',
        recipientType: 'company',
        storagePath: 'orders/AF-2026-00001/invoice.pdf',
      },
      order_cancellation_requests: [{ id: 'cancel-id', status: 'open' }],
      order_items: [
        {
          brand_name: 'Brand A',
          item_snapshot: { productImage: null },
          line_position: 2,
          line_type: 'cpo',
          product_name: 'CPO Item',
          quantity: 1,
        },
        {
          brand_name: 'Brand B',
          item_snapshot: {
            productImage: {
              id: 'image-abc-100x100-webp',
              preview: 'data:image/png;base64,xyz',
              alt: 'Standard Item',
              naturalWidth: 100,
              naturalHeight: 100,
            },
          },
          line_position: 1,
          line_type: 'standard',
          product_name: 'Standard Item',
          quantity: 2,
        },
      ],
      order_number: 'AF-2026-00001',
      paid_at: '2026-05-06T08:05:00.000Z',
      payable_until: '2026-05-06T08:15:00.000Z',
      return_cases: [{ id: 'return-id', status: 'open' }],
      shipment_data: {
        carrier: 'DHL',
        shippedAt: '2026-05-07T08:00:00.000Z',
        trackingNumber: 'TRACK123',
      },
      shipped_at: null,
    });

    expect(order).toEqual(
      expect.objectContaining({
        id: 'order-id',
        orderNumber: 'AF-2026-00001',
        customer: {
          displayName: 'Jan Kowalski',
          email: 'customer@example.com',
          phone: '+48123456789',
        },
        invoice: {
          attachedAt: '2026-05-06T09:00:00.000Z',
          hasInvoice: true,
          recipientType: 'company',
        },
        shipment: {
          carrier: 'DHL',
          hasShipment: true,
          shippedAt: '2026-05-07T08:00:00.000Z',
          trackingNumber: 'TRACK123',
        },
        hasOpenCancellationRequest: true,
        hasOpenReturnCase: true,
      }),
    );
    expect(order.itemSummary).toEqual({
      containsCpo: true,
      leadItem: {
        brandName: 'Brand B',
        productName: 'Standard Item',
        productImage: {
          alt: 'Standard Item',
          id: 'image-abc-100x100-webp',
          naturalHeight: 100,
          naturalWidth: 100,
          preview: 'data:image/png;base64,xyz',
        },
      },
      lineTypes: ['cpo', 'standard'],
      totalItemCount: 3,
    });
  });

  it('returns allowed admin status transitions', () => {
    expect(adminOrderTesting.getAllowedNextStatuses('paid')).toEqual([
      'processing',
      'shipped',
      'completed',
      'cancelled',
    ]);
    expect(
      adminOrderTesting.getAllowedNextStatuses('awaiting_payment'),
    ).toEqual([]);
    expect(adminOrderTesting.getAllowedNextStatuses('returned')).toEqual([]);
  });
});
