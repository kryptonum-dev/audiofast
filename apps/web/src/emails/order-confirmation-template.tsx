import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import { EmailLayout } from './components/EmailLayout';
import { OrderSummary, type OrderSummaryItem } from './components/OrderSummary';

export type OrderConfirmationAddressBlock = {
  heading: string;
  recipientName: string;
  phone: string | null;
  lines: string[];
};

export type OrderConfirmationInvoiceBlock = {
  companyName: string;
  taxId: string | null;
  lines: string[];
};

export type OrderConfirmationTemplateProps = {
  customerFirstName: string;
  customerEmail: string;
  orderNumber: string;
  items: OrderSummaryItem[];
  subtotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
  shippingAddress: OrderConfirmationAddressBlock;
  invoiceDetails: OrderConfirmationInvoiceBlock | null;
  loginUrl: string;
};

export function OrderConfirmationTemplate({
  customerFirstName,
  customerEmail,
  orderNumber,
  items,
  subtotalCents,
  discountTotalCents,
  grandTotalCents,
  shippingAddress,
  invoiceDetails,
  loginUrl,
}: OrderConfirmationTemplateProps) {
  const previewText = `Potwierdzenie zamówienia ${orderNumber}`;

  return (
    <EmailLayout
      previewText={previewText}
      headerSubtitle="Potwierdzenie zamówienia"
      footerNote="To jest automatyczne potwierdzenie opłaconego zamówienia. W razie pytań skontaktuj się z zespołem Audiofast."
      showHeaderLogo={false}
      showFooterLogo={false}
    >
      <Section style={heroSection}>
        <Text style={heroHeading}>Dziękujemy za złożenie zamówienia</Text>
        <Text style={heroText}>
          Witaj {customerFirstName}, płatność za zamówienie{' '}
          <strong style={strongText}>{orderNumber}</strong> została
          zweryfikowana. O kolejnych etapach realizacji będziemy informować Cię
          mailowo.
        </Text>
        <Text style={heroMeta}>
          Dostęp do twojego zamówienia jest przypisany do adresu{' '}
          <strong style={strongText}>{customerEmail}</strong>.
        </Text>
        <Section style={ctaRow}>
          <Button href={loginUrl} style={primaryButton}>
            <span style={buttonLabelCell}>Przejdź do konta klienta</span>
          </Button>
        </Section>
      </Section>

      <OrderSummary
        title="Podsumowanie zamówienia"
        items={items}
        subtotalCents={subtotalCents}
        discountTotalCents={discountTotalCents}
        grandTotalCents={grandTotalCents}
      />

      <Section style={detailsSection}>
        <Text style={sectionEyebrow}>Dane do zamówienia</Text>
        <Section style={detailCard}>
          <Text style={detailHeading}>{shippingAddress.heading}</Text>
          <Text style={detailRecipient}>{shippingAddress.recipientName}</Text>
          {shippingAddress.phone ? (
            <Text style={detailLine}>tel. {shippingAddress.phone}</Text>
          ) : null}
          {shippingAddress.lines.map((line) => (
            <Text key={line} style={detailLine}>
              {line}
            </Text>
          ))}
        </Section>

        {invoiceDetails ? (
          <Section style={detailCard}>
            <Text style={detailHeading}>Dane do faktury</Text>
            <Text style={detailRecipient}>{invoiceDetails.companyName}</Text>
            {invoiceDetails.taxId ? (
              <Text style={detailLine}>NIP: {invoiceDetails.taxId}</Text>
            ) : null}
            {invoiceDetails.lines.map((line) => (
              <Text key={line} style={detailLine}>
                {line}
              </Text>
            ))}
          </Section>
        ) : null}
      </Section>

      <Section style={infoSection}>
        <Text style={infoText}>
          Jeśli logujesz się jako gość, użyj tego samego adresu e-mail przy
          logowaniu do konta klienta. Dzięki temu zobaczysz status zamówienia i
          historię kolejnych etapów realizacji.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const heroSection = {
  padding: '48px 32px',
};

const heroHeading = {
  fontSize: '30px',
  lineHeight: '1.12',
  color: '#141414',
  fontWeight: '600',
  letterSpacing: '-0.03em',
  margin: '0 0 18px',
  fontFamily: '"Switzer", "Poppins", Arial, Helvetica, sans-serif',
};

const heroText = {
  fontSize: '15px',
  lineHeight: '1.7',
  color: '#5b5a5a',
  margin: '0 0 14px',
};

const strongText = {
  color: '#000000',
};

const heroMeta = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#303030',
  margin: '0 0 24px',
};

const ctaRow = {
  margin: '0',
};

const primaryButton = {
  backgroundColor: '#fe0140',
  borderRadius: '8px',
  color: '#ffffff',
  textDecoration: 'none',
  display: 'inline-block',
  padding: '13px 20px',
};

const buttonLabelCell = {
  display: 'inline-block',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '500',
  letterSpacing: '-0.02em',
};

const detailsSection = {
  padding: '0 32px 28px',
};

const sectionEyebrow = {
  fontSize: '12px',
  color: '#808080',
  textTransform: 'uppercase' as const,
  fontWeight: '600',
  letterSpacing: '0.06em',
  margin: '0 0 12px',
};

const detailCard = {
  backgroundColor: '#f8f8f8',
  border: '1px solid #e7e7e7',
  borderRadius: '14px',
  padding: '20px 18px',
  margin: '0 0 12px',
};

const detailHeading = {
  fontSize: '13px',
  color: '#808080',
  textTransform: 'uppercase' as const,
  fontWeight: '600',
  letterSpacing: '0.06em',
  margin: '0 0 8px',
};

const detailRecipient = {
  fontSize: '15px',
  color: '#303030',
  fontWeight: '600',
  margin: '0 0 8px',
};

const detailLine = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#5b5a5a',
  margin: '0 0 4px',
};

const infoSection = {
  padding: '0 32px 32px',
};

const infoText = {
  fontSize: '13px',
  lineHeight: '1.7',
  color: '#5b5a5a',
  margin: '0',
};

export default OrderConfirmationTemplate;
