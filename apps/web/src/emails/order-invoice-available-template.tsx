import {
  Heading,
  Hr,
  Section,
  Text,
} from '@react-email/components';

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
      <Section style={container}>
        <Heading style={heading}>Faktura do zamówienia</Heading>
        <Text style={paragraph}>
          Do zamówienia <strong>{orderNumber}</strong> została dodana faktura.
        </Text>
        <Text style={paragraph}>
          Dokument PDF znajdziesz w załączniku do tej wiadomości.
        </Text>
        <Hr style={divider} />
        <Text style={footer}>
          Jeżeli masz pytania dotyczące dokumentu, odpowiedz na tę wiadomość lub
          skontaktuj się z zespołem Audiofast.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const container = {
  margin: '0',
};

const heading = {
  color: '#111111',
  fontSize: '24px',
  lineHeight: '32px',
  margin: '0 0 16px',
};

const paragraph = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const divider = {
  borderColor: '#e5e5e5',
  margin: '24px 0',
};

const footer = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '21px',
  margin: '0',
};
