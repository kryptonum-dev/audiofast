import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import { EmailLayout } from './components/EmailLayout';

export type OrderStatusUpdateTemplateProps = {
  customerFirstName: string;
  orderNumber: string;
  statusLabel: string;
  message: string;
  deliveryEstimateLabel: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  loginUrl: string;
};

export function OrderStatusUpdateTemplate({
  customerFirstName,
  orderNumber,
  statusLabel,
  message,
  deliveryEstimateLabel,
  trackingNumber,
  trackingUrl,
  loginUrl,
}: OrderStatusUpdateTemplateProps) {
  const trackingBaseUrl = trackingUrl ? getTrackingBaseUrl(trackingUrl) : null;

  return (
    <EmailLayout
      previewText={`Aktualizacja zamówienia ${orderNumber}`}
      headerSubtitle="Aktualizacja zamówienia"
      footerNote="To jest automatyczna wiadomość dotycząca statusu zamówienia. W razie pytań skontaktuj się z zespołem Audiofast."
      showHeaderLogo={false}
      showFooterLogo={false}
    >
      <Section style={heroSection}>
        <Text style={heroHeading}>Status zamówienia został zaktualizowany</Text>
        <Text style={heroText}>
          Witaj {customerFirstName}, status zamówienia{' '}
          <strong style={strongText}>{orderNumber}</strong> zmienił się na{' '}
          <strong style={strongText}>{statusLabel}</strong>.
        </Text>
        <Text style={heroText}>{message}</Text>
        {deliveryEstimateLabel ? (
          <Text style={heroMeta}>
            Przewidywana dostawa:{' '}
            <strong style={strongText}>{deliveryEstimateLabel}</strong>
          </Text>
        ) : null}
        {trackingNumber ? (
          <Text style={heroMeta}>
            Numer listu przewozowego:{' '}
            <strong style={strongText}>{trackingNumber}</strong>
          </Text>
        ) : null}
        <Section style={ctaRow}>
          <Button href={loginUrl} style={primaryButton}>
            <span style={buttonLabelCell}>Zobacz zamówienie</span>
          </Button>
          {trackingBaseUrl ? (
            <Button href={trackingBaseUrl} style={secondaryButton}>
              <span style={secondaryButtonLabelCell}>
                Otwórz stronę śledzenia
              </span>
            </Button>
          ) : null}
        </Section>
      </Section>
    </EmailLayout>
  );
}

function getTrackingBaseUrl(trackingUrl: string): string | null {
  try {
    const url = new URL(trackingUrl);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
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
  margin: '0 0 16px',
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

const secondaryButton = {
  backgroundColor: '#ffffff',
  border: '1px solid #d8d8d8',
  borderRadius: '8px',
  color: '#141414',
  textDecoration: 'none',
  display: 'inline-block',
  marginLeft: '10px',
  padding: '12px 18px',
};

const buttonLabelCell = {
  display: 'inline-block',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '500',
  letterSpacing: '-0.02em',
};

const secondaryButtonLabelCell = {
  display: 'inline-block',
  color: '#141414',
  fontSize: '14px',
  fontWeight: '500',
  letterSpacing: '-0.02em',
};
