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

interface ContactConfirmationTemplateProps {
  name?: string;
  email: string;
  message?: string;
  subject: string;
  htmlContent: string;
}

export const ContactConfirmationTemplate = ({
  name,
  email,
  message,
  subject,
  htmlContent,
}: ContactConfirmationTemplateProps) => {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header Section */}
          <Section style={headerSection}>
            <Heading style={h1}>Audiofast</Heading>
          </Section>

          {/* Content Section */}
          <Section style={section}>
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={hr} />
            <Text style={footerText}>
              Audiofast - Dystrybutor sprzętu High-End
              <br />
              ul. Romankowska 55E, 91-174 Łódź
            </Text>
            <Text style={footerText}>
              <a href="https://audiofast.pl" style={footerLink}>
                www.audiofast.pl
              </a>
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
};

const h1 = {
  color: '#303030', // --neutral-700
  fontSize: '24px',
  fontWeight: '500',
  margin: '0',
  fontFamily: 'Arial, Helvetica, sans-serif',
};

const section = {
  padding: '32px 20px',
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
  margin: '0 0 12px',
};

const footerLink = {
  color: '#5b5a5a', // --neutral-600
  textDecoration: 'underline',
};

export default ContactConfirmationTemplate;


