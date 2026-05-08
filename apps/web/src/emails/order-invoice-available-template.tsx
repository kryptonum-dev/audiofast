import { Section, Text } from '@react-email/components';

import { EmailLayout } from './components/EmailLayout';

export type OrderInvoiceAvailableTemplateProps = {
  orderNumber: string;
};

export function OrderInvoiceAvailableTemplate({
  orderNumber,
}: OrderInvoiceAvailableTemplateProps) {
  const preview = `Faktura do zamówienia ${orderNumber} jest dostępna.`;

  return (
    <EmailLayout
      footerNote="To jest automatyczna wiadomość dotycząca dokumentów zamówienia."
      headerSubtitle="Faktura"
      previewText={preview}
      showFooterLogo={false}
      showHeaderLogo={false}
    >
      <Section style={heroSection}>
        <Text style={heroHeading}>Faktura do zamówienia</Text>
        <Text style={heroText}>
          Do zamówienia <strong style={strongText}>{orderNumber}</strong>{' '}
          została dodana faktura.
        </Text>
        <Text style={heroText}>
          Dokument PDF znajdziesz w załączniku do tej wiadomości.
        </Text>
        <Text style={heroMeta}>
          Jeżeli masz pytania dotyczące dokumentu, skontaktuj się z zespołem
          Audiofast.
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
  margin: '0',
};
