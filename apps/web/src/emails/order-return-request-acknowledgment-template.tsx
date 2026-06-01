import { Button, Section, Text } from '@react-email/components';

import { EmailLayout } from './components/EmailLayout';

export type OrderReturnRequestAcknowledgmentTemplateProps = {
  customerFirstName: string;
  loginUrl: string;
  orderNumber: string;
};

export function OrderReturnRequestAcknowledgmentTemplate({
  customerFirstName,
  loginUrl,
  orderNumber,
}: OrderReturnRequestAcknowledgmentTemplateProps) {
  return (
    <EmailLayout
      footerNote="To jest automatyczna wiadomość dotycząca zgłoszenia zwrotu."
      headerSubtitle="Zgłoszenie zwrotu"
      previewText={`Otrzymaliśmy zgłoszenie zwrotu zamówienia ${orderNumber}.`}
      showFooterLogo={false}
      showHeaderLogo={false}
    >
      <Section style={heroSection}>
        <Text style={heroHeading}>Otrzymaliśmy zgłoszenie zwrotu</Text>
        <Text style={heroText}>
          Witaj {customerFirstName}, otrzymaliśmy zgłoszenie zwrotu dla
          zamówienia <strong style={strongText}>{orderNumber}</strong>.
        </Text>
        <Text style={heroText}>
          Audiofast sprawdzi zgłoszenie. Po potwierdzeniu otrzymasz osobną
          wiadomość z instrukcją odesłania towaru.
        </Text>
        <Section style={ctaRow}>
          <Button href={loginUrl} style={primaryButton}>
            <span style={buttonLabelCell}>Zobacz zamówienie</span>
          </Button>
        </Section>
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

const ctaRow = {
  margin: '24px 0 0',
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
