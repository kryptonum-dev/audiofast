import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

type ProductInquiryData = {
  name: string;
  brandName: string;
  configuration: Array<{
    label: string;
    value: string;
    priceDelta: number;
  }>;
  basePrice: number;
  totalPrice: number;
};

interface ContactNotificationTemplateProps {
  name?: string;
  email: string;
  message?: string;
  product?: ProductInquiryData;
}

// Format price from cents to PLN string
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export const ContactNotificationTemplate = ({
  name,
  email,
  message,
  product,
}: ContactNotificationTemplateProps) => {
  const previewText = product
    ? `Zapytanie o produkt: ${product.brandName} ${product.name}`
    : 'Nowe zgłoszenie z formularza kontaktowego';

  const headingText = product
    ? 'Zapytanie o produkt'
    : 'Nowe zgłoszenie z formularza';

  // Calculate total additions for product
  const totalAdditions = product
    ? product.configuration.reduce((sum, item) => sum + item.priceDelta, 0)
    : 0;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header Section */}
          <Section style={headerSection}>
            <Heading style={h1}>Audiofast</Heading>
            <Text style={headerSubtitle}>Panel administracyjny</Text>
          </Section>

          {/* Content Section */}
          <Section style={section}>
            <Heading style={h2}>{headingText}</Heading>

            {/* Product Section - Only shown if product exists */}
            {product && (
              <Section style={productSection}>
                <Text style={productBrand}>{product.brandName}</Text>
                <Text style={productName}>{product.name}</Text>

                {product.configuration.length > 0 && (
                  <Section style={configSection}>
                    <Text style={configHeading}>Wybrana konfiguracja:</Text>
                    {product.configuration.map((item, index) => (
                      <Section key={index} style={configRow}>
                        <Text style={configLabel}>{item.label}:</Text>
                        <Text style={configValue}>
                          {item.value}
                          {item.priceDelta > 0 && (
                            <span style={configPrice}>
                              {' '}
                              (+{formatPrice(item.priceDelta)})
                            </span>
                          )}
                        </Text>
                      </Section>
                    ))}
                  </Section>
                )}

                <Section style={priceSection}>
                  {totalAdditions > 0 && (
                    <>
                      <Section style={priceRow}>
                        <Text style={priceLabel}>Cena bazowa:</Text>
                        <Text style={priceValue}>
                          {formatPrice(product.basePrice)}
                        </Text>
                      </Section>
                      <Section style={priceRow}>
                        <Text style={priceLabel}>Dodatki:</Text>
                        <Text style={priceValue}>
                          +{formatPrice(totalAdditions)}
                        </Text>
                      </Section>
                      <Hr style={priceDivider} />
                    </>
                  )}
                  <Section style={priceRow}>
                    <Text style={priceTotalLabel}>Razem:</Text>
                    <Text style={priceTotalValue}>
                      {formatPrice(product.totalPrice)}
                    </Text>
                  </Section>
                </Section>
              </Section>
            )}

            {/* Contact Info Section */}
            <Section style={infoSection}>
              {name && (
                <Section style={infoRow}>
                  <Text style={infoLabel}>Imię i nazwisko:</Text>
                  <Text style={infoValue}>{name}</Text>
                </Section>
              )}

              <Section style={infoRow}>
                <Text style={infoLabel}>E-mail:</Text>
                <Text style={infoValue}>
                  <a href={`mailto:${email}`} style={emailLink}>
                    {email}
                  </a>
                </Text>
              </Section>

              {message && (
                <Section style={infoRow}>
                  <Text style={infoLabel}>Wiadomość:</Text>
                  <Text style={messageValue}>{message}</Text>
                </Section>
              )}
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={hr} />
            <Text style={footerText}>
              Ten e-mail został wygenerowany automatycznie przez system
              formularzy Audiofast.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles - Colors matching global.scss and newsletter template
const main = {
  backgroundColor: '#f8f8f8', // --neutral-200
  fontFamily: 'Arial, Helvetica, sans-serif',
  color: '#5b5a5a', // --neutral-600
};

const container = {
  margin: '0 auto',
  padding: '0 0 48px',
  maxWidth: '600px',
  backgroundColor: '#ffffff', // --neutral-white
};

const headerSection = {
  padding: '32px 20px',
  textAlign: 'center' as const,
  borderBottom: '2px solid #fe0140', // --primary-red
  backgroundColor: '#f7f3f3', // --neutral-300
};

const h1 = {
  color: '#303030', // --neutral-700
  fontSize: '24px',
  fontWeight: '500',
  margin: '0 0 8px',
  fontFamily: 'Arial, Helvetica, sans-serif',
};

const headerSubtitle = {
  fontSize: '12px',
  color: '#c5c5c5', // --neutral-500
  textTransform: 'uppercase' as const,
  fontWeight: '500',
  letterSpacing: '0.05em',
  margin: '0',
};

const section = {
  padding: '32px 20px',
};

const h2 = {
  color: '#303030', // --neutral-700
  fontSize: '20px',
  fontWeight: '500',
  margin: '0 0 24px',
  paddingBottom: '12px',
  borderBottom: '2px solid #fe0140', // --primary-red
  display: 'inline-block',
  fontFamily: 'Arial, Helvetica, sans-serif',
};

// Product section styles
const productSection = {
  margin: '0 0 24px',
  padding: '20px',
  backgroundColor: '#f8f8f8', // --neutral-200
  borderRadius: '8px',
  borderLeft: '4px solid #fe0140', // --primary-red
};

const productBrand = {
  fontSize: '12px',
  color: '#808080', // --neutral-500
  textTransform: 'uppercase' as const,
  fontWeight: '600',
  letterSpacing: '0.08em',
  margin: '0 0 4px',
};

const productName = {
  fontSize: '18px',
  fontWeight: '500',
  color: '#303030', // --neutral-700
  margin: '0 0 16px',
  lineHeight: '1.3',
};

const configSection = {
  margin: '0 0 16px',
  padding: '12px',
  backgroundColor: '#ffffff',
  borderRadius: '4px',
};

const configHeading = {
  fontSize: '11px',
  color: '#808080', // --neutral-500
  textTransform: 'uppercase' as const,
  fontWeight: '600',
  letterSpacing: '0.05em',
  margin: '0 0 12px',
};

const configRow = {
  margin: '0 0 8px',
};

const configLabel = {
  fontSize: '12px',
  color: '#808080', // --neutral-500
  margin: '0',
};

const configValue = {
  fontSize: '14px',
  fontWeight: '500',
  color: '#303030', // --neutral-700
  margin: '2px 0 0',
};

const configPrice = {
  color: '#5b5a5a', // --neutral-600
  fontWeight: '400',
};

const priceSection = {
  margin: '0',
  padding: '12px',
  backgroundColor: '#ffffff',
  borderRadius: '4px',
};

const priceRow = {
  display: 'flex',
  justifyContent: 'space-between',
  margin: '0 0 4px',
};

const priceLabel = {
  fontSize: '13px',
  color: '#5b5a5a', // --neutral-600
  margin: '0',
};

const priceValue = {
  fontSize: '13px',
  fontWeight: '500',
  color: '#5b5a5a', // --neutral-600
  margin: '0',
  textAlign: 'right' as const,
};

const priceDivider = {
  borderColor: '#e8e8e8',
  margin: '8px 0',
};

const priceTotalLabel = {
  fontSize: '14px',
  fontWeight: '500',
  color: '#303030', // --neutral-700
  margin: '0',
};

const priceTotalValue = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#303030', // --neutral-700
  margin: '0',
  textAlign: 'right' as const,
};

const infoSection = {
  margin: '0',
};

const infoRow = {
  margin: '0 0 20px',
  padding: '16px',
  backgroundColor: '#f8f8f8', // --neutral-200
  borderRadius: '4px',
};

const infoLabel = {
  fontSize: '12px',
  color: '#fe0140', // --primary-red
  textTransform: 'uppercase' as const,
  fontWeight: '500',
  letterSpacing: '0.05em',
  margin: '0 0 8px',
};

const infoValue = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#303030', // --neutral-700
  margin: '0',
  fontWeight: '500',
};

const messageValue = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#5b5a5a', // --neutral-600
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
};

const emailLink = {
  color: '#fe0140', // --primary-red
  textDecoration: 'none',
};

const hr = {
  borderColor: '#e7e7e7', // --neutral-400
  margin: '20px 0',
};

const footer = {
  padding: '0 20px',
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '12px',
  color: '#c5c5c5', // --neutral-500
  lineHeight: '1.5',
  margin: '0',
};

export default ContactNotificationTemplate;


