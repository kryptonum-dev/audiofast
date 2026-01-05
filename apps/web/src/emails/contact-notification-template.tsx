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

interface ContactNotificationTemplateProps {
  name?: string;
  email: string;
  message?: string;
}

export const ContactNotificationTemplate = ({
  name,
  email,
  message,
}: ContactNotificationTemplateProps) => {
  return (
    <Html>
      <Head />
      <Preview>Nowe zgłoszenie z formularza kontaktowego</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header Section */}
          <Section style={headerSection}>
            <Heading style={h1}>Audiofast</Heading>
            <Text style={headerSubtitle}>Panel administracyjny</Text>
          </Section>

          {/* Content Section */}
          <Section style={section}>
            <Heading style={h2}>Nowe zgłoszenie z formularza</Heading>

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


