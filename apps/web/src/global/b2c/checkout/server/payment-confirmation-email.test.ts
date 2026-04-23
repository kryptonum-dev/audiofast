import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';
import { sendTransactionalEmail } from '@/src/global/email/service';

import { sendCheckoutPaymentConfirmationEmail } from './payment-confirmation-email';

type ReactEmailCall = {
  react: {
    props: {
      customerFirstName: string;
      customerEmail: string;
      orderNumber: string;
      subtotalCents: number;
      discountTotalCents: number;
      grandTotalCents: number;
      shippingAddress: {
        recipientName: string;
        phone: string | null;
      };
      invoiceDetails: {
        companyName: string;
        taxId: string | null;
      } | null;
      items: Array<{
        id: string;
        brandName: string;
        productName: string;
        quantity: number;
        lineTotalCents: number;
        details: string[];
      }>;
    };
  };
};

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/src/global/email/service', () => ({
  getTransactionalReplyToEmail: vi.fn(() => 'www@audiofast.pl'),
  sendTransactionalEmail: vi.fn(),
}));

describe('sendCheckoutPaymentConfirmationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      success: true,
    });
  });

  it('loads the paid order, builds the confirmation template, and sends the email', async () => {
    const itemsOrderMock = vi.fn().mockResolvedValue({
      data: [
        {
          line_position: 1,
          brand_name: 'Test brand',
          product_name: 'Test product',
          quantity: 1,
          line_total_cents: 200_00,
          item_snapshot: {
            model: 'Reference',
            selectedOptions: [
              {
                groupName: 'Kolor',
                valueName: 'Czarny',
                numericValue: null,
                unit: null,
              },
            ],
          },
        },
      ],
      error: null,
    });
    const itemsEqMock = vi.fn(() => ({
      order: itemsOrderMock,
    }));
    const itemsSelectMock = vi.fn(() => ({
      eq: itemsEqMock,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'order_items') {
          return {
            select: itemsSelectMock,
          };
        }

        throw new Error(`Unexpected table ${table}.`);
      }),
    } as never);

    await sendCheckoutPaymentConfirmationEmail({
      order: {
        id: 'order-1',
        order_number: 'AF-2026-00001',
        customer_email: 'jan@example.com',
        customer_snapshot: {
          firstName: 'Jan',
          lastName: 'Kowalski',
        },
        shipping_address_snapshot: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123123123',
          streetName: 'Testowa',
          buildingNumber: '1',
          apartmentNumber: '2',
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL',
        },
        invoice_data: {
          recipientType: 'company',
          companyName: 'Audiofast Pro',
          taxId: '1234567890',
          invoiceAddress: {
            streetName: 'Firmowa',
            buildingNumber: '10',
            apartmentNumber: null,
            postalCode: '00-002',
            city: 'Warszawa',
            country: 'PL',
          },
        },
        subtotal_cents: 230_00,
        discount_total_cents: 30_00,
        grand_total_cents: 200_00,
      },
    });

    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: {
          email: 'jan@example.com',
          name: 'Jan Kowalski',
        },
        subject: 'Audiofast | Potwierdzenie zamówienia AF-2026-00001',
        replyTo: 'www@audiofast.pl',
      }),
    );

    const renderedEmail = vi.mocked(sendTransactionalEmail).mock
      .calls[0]?.[0] as ReactEmailCall | undefined;
    expect(renderedEmail?.react.props).toMatchObject({
      customerFirstName: 'Jan',
      customerEmail: 'jan@example.com',
      orderNumber: 'AF-2026-00001',
      subtotalCents: 230_00,
      discountTotalCents: 30_00,
      grandTotalCents: 200_00,
      shippingAddress: {
        recipientName: 'Jan Kowalski',
        phone: '123123123',
      },
      invoiceDetails: {
        companyName: 'Audiofast Pro',
        taxId: '1234567890',
      },
    });
    expect(renderedEmail?.react.props.items).toEqual([
      {
        id: '1-Test product',
        brandName: 'Test brand',
        productName: 'Test product',
        quantity: 1,
        lineTotalCents: 200_00,
        details: ['Model: Reference', 'Kolor: Czarny'],
      },
    ]);
  });

  it('throws when the underlying email service reports a failure', async () => {
    const itemsOrderMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const itemsEqMock = vi.fn(() => ({
      order: itemsOrderMock,
    }));
    const itemsSelectMock = vi.fn(() => ({
      eq: itemsEqMock,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'order_items') {
          return {
            select: itemsSelectMock,
          };
        }

        throw new Error(`Unexpected table ${table}.`);
      }),
    } as never);
    vi.mocked(sendTransactionalEmail).mockResolvedValueOnce({
      success: false,
      error: 'boom',
    });

    await expect(
      sendCheckoutPaymentConfirmationEmail({
        order: {
          id: 'order-1',
          order_number: 'AF-2026-00001',
          customer_email: 'jan@example.com',
          customer_snapshot: {
            firstName: 'Jan',
            lastName: 'Kowalski',
          },
          shipping_address_snapshot: {
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: null,
            streetName: 'Testowa',
            buildingNumber: '1',
            apartmentNumber: null,
            postalCode: '00-001',
            city: 'Warszawa',
            country: 'PL',
          },
          invoice_data: null,
          subtotal_cents: 100_00,
          discount_total_cents: 0,
          grand_total_cents: 100_00,
        },
      }),
    ).rejects.toThrow('boom');
  });
});
