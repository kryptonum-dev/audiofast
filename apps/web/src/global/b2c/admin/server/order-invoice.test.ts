import { describe, expect, it } from 'vitest';

import { buildAdminInvoiceDataPayload } from './order-invoice';

describe('admin order invoice helpers', () => {
  it('preserves existing invoice recipient data when attaching a PDF', () => {
    expect(
      buildAdminInvoiceDataPayload({
        attachedAt: '2026-05-06T08:00:00.000Z',
        currentInvoiceData: {
          companyName: 'Audiofast Sp. z o.o.',
          recipientType: 'company',
          taxId: '1234567890',
        },
        filename: 'audiofast-invoice.pdf',
        storagePath: 'orders/AF-2026-00001/invoice.pdf',
        updatedAt: '2026-05-06T09:00:00.000Z',
      }),
    ).toEqual({
      invoice_data: {
        attachedAt: '2026-05-06T08:00:00.000Z',
        companyName: 'Audiofast Sp. z o.o.',
        filename: 'audiofast-invoice.pdf',
        recipientType: 'company',
        storagePath: 'orders/AF-2026-00001/invoice.pdf',
        taxId: '1234567890',
      },
      updated_at: '2026-05-06T09:00:00.000Z',
    });
  });
});
