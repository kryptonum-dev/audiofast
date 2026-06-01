import {
  Section,
} from '@react-email/components';
import * as React from 'react';

import { EmailLayout } from './components/EmailLayout';

interface ContactConfirmationTemplateProps {
  name?: string;
  email: string;
  message?: string;
  subject: string;
  htmlContent: string;
}

export const ContactConfirmationTemplate = ({
  subject,
  htmlContent,
}: ContactConfirmationTemplateProps) => {
  return (
    <EmailLayout previewText={subject}>
      <Section style={section}>
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </Section>
    </EmailLayout>
  );
};

const section = {
  padding: '32px 20px',
};

export default ContactConfirmationTemplate;


