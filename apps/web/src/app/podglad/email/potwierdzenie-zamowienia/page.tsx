import { render } from '@react-email/render';
import type { Metadata } from 'next';

import type { OrderConfirmationTemplateProps } from '@/src/emails/order-confirmation-template';
import { OrderConfirmationTemplate } from '@/src/emails/order-confirmation-template';

export const metadata: Metadata = {
  title: 'Podgląd maila | Potwierdzenie zamówienia',
  description: 'Wewnętrzny podgląd maila potwierdzenia zamówienia.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

function extractBodyHtml(documentHtml: string): string {
  const match = documentHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match?.[1] ?? documentHtml;
}

const previewProps: OrderConfirmationTemplateProps = {
  customerFirstName: 'Jan',
  customerEmail: 'jan.kowalski@example.com',
  orderNumber: 'AF-2026-00007',
  items: [
    {
      id: '1-marantz-model-10',
      brandName: 'Marantz',
      productName: 'MODEL 10',
      quantity: 1,
      lineTotalCents: 68_900_00,
      details: ['Kolor: Czarny', 'Napięcie: 230V'],
    },
    {
      id: '2-bowers-wilkins-805',
      brandName: 'Bowers & Wilkins',
      productName: '805 D4 Signature',
      quantity: 1,
      lineTotalCents: 52_000_00,
      details: ['Wykończenie: Midnight Blue Metallic'],
    },
  ],
  subtotalCents: 120_900_00,
  discountTotalCents: 1_900_00,
  grandTotalCents: 119_000_00,
  shippingAddress: {
    heading: 'Adres dostawy',
    recipientName: 'Jan Kowalski',
    phone: '+48 123 123 123',
    lines: ['ul. Testowa 15 / 7', '00-001 Warszawa', 'Polska'],
  },
  invoiceDetails: {
    companyName: 'Audio Vision Pro Sp. z o.o.',
    taxId: '5252876543',
    lines: ['ul. Firmowa 8', '00-950 Warszawa', 'Polska'],
  },
  loginUrl: 'https://audiofast.pl/konto-klienta/',
};

export default async function OrderConfirmationEmailPreviewPage() {
  const emailHtml = await render(OrderConfirmationTemplate(previewProps));
  const emailBodyHtml = extractBodyHtml(emailHtml);

  return (
    <main
      aria-label="Podgląd maila potwierdzenia zamówienia"
      style={pageStyle}
      dangerouslySetInnerHTML={{ __html: emailBodyHtml }}
    />
  );
}

const pageStyle = {
  position: 'fixed' as const,
  inset: 0,
  zIndex: 2147483647,
  overflowY: 'auto' as const,
  width: '100%',
  minHeight: '100vh',
  backgroundColor: '#f4f4f4',
  padding: '24px 0',
};
