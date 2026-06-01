import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  FALLBACK_EMAIL_BODY,
  FALLBACK_EMAIL_SUBJECT,
  FALLBACK_SUPPORT_EMAIL,
  REGEX,
} from '@/global/constants';
import { isGraphConfigured } from '@/global/microsoft-graph/client';
import { sanityFetch } from '@/global/sanity/fetch';
import { queryContactSettings } from '@/global/sanity/query';
import type { QueryContactSettingsResult } from '@/global/sanity/sanity.types';
import type { PortableTextProps } from '@/global/types';
import { portableTextToHtml } from '@/global/utils';
import { ContactConfirmationTemplate } from '@/src/emails/contact-confirmation-template';
import { ContactNotificationTemplate } from '@/src/emails/contact-notification-template';
import {
  sendTransactionalEmails,
  type TransactionalEmailInput,
} from '@/src/global/email/service';

// Reply-to address for confirmation emails
const REPLY_TO_EMAIL =
  process.env.MS_GRAPH_REPLY_TO || process.env.MS_GRAPH_SENDER_EMAIL;

type ProductInquiryData = {
  name: string;
  brandName: string;
  kind?: 'standard' | 'cpo';
  configuration: Array<{
    label: string;
    value: string;
    priceDelta: number;
  }>;
  basePrice: number | null;
  totalPrice: number | null;
};

type FormSubmission = {
  name?: string;
  email: string;
  message?: string;
  consent: boolean;
  product?: ProductInquiryData;
};

type ContactSettingsType = {
  supportEmails: string[];
  confirmationEmail: {
    subject: string;
    content: string;
  };
};

type ContactSettingsSupportEmails =
  NonNullable<QueryContactSettingsResult>['supportEmails'];

// Get contact settings with fallbacks
function getContactConfig(
  contactSettings: QueryContactSettingsResult | null | undefined,
): ContactSettingsType {
  const supportEmails = normalizeSupportEmails(contactSettings?.supportEmails);

  const subject =
    contactSettings?.confirmationEmail?.subject || FALLBACK_EMAIL_SUBJECT;
  const content =
    portableTextToHtml(
      contactSettings?.confirmationEmail?.content as PortableTextProps,
    ) || FALLBACK_EMAIL_BODY;

  return {
    supportEmails,
    confirmationEmail: {
      subject,
      content,
    },
  };
}

function normalizeSupportEmails(
  supportEmails: ContactSettingsSupportEmails | null | undefined,
): string[] {
  const normalizedEmails =
    supportEmails
      ?.map((email) => email.trim().toLowerCase())
      .filter((email, index, allEmails) => {
        return (
          email.length > 0 &&
          REGEX.email.test(email) &&
          allEmails.indexOf(email) === index
        );
      }) ?? [];

  return normalizedEmails.length > 0
    ? normalizedEmails
    : [FALLBACK_SUPPORT_EMAIL.trim().toLowerCase()];
}

// Escape HTML to prevent injection
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}

// Replace placeholders in text (for content from Sanity)
function replacePlaceholders(
  text: string,
  variables: { name?: string; email?: string; message?: string },
): string {
  return text
    .replace(/\{\{name\}\}/g, escapeHtml(variables.name || ''))
    .replace(/\{\{email\}\}/g, escapeHtml(variables.email || ''))
    .replace(/\{\{message\}\}/g, escapeHtml(variables.message || ''));
}

export async function POST(request: NextRequest) {
  // Validate Microsoft Graph is configured
  if (!isGraphConfigured()) {
    console.error('[Contact API] Microsoft Graph not configured');
    return NextResponse.json(
      { success: false, message: 'Email service not configured' },
      { status: 500 },
    );
  }

  // Parse request body
  let body: FormSubmission;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON' },
      { status: 400 },
    );
  }

  // Validate required fields
  if (!body.email || !body.consent) {
    return NextResponse.json(
      { success: false, message: 'Email and consent are required' },
      { status: 400 },
    );
  }

  // Fetch contact settings from Sanity
  let contactSettings;
  try {
    contactSettings = await sanityFetch<QueryContactSettingsResult>({
      query: queryContactSettings,
      tags: ['settings'],
    });
  } catch (error) {
    console.error('[Contact API] Failed to fetch contact settings', error);
  }

  const emailConfig = getContactConfig(contactSettings);

  // Prepare variables for template replacement
  const variables = {
    name: body.name || '',
    email: body.email,
    message: body.message || '',
  };

  // Render confirmation email content
  const confirmationSubject = replacePlaceholders(
    emailConfig.confirmationEmail.subject,
    variables,
  );
  const confirmationContentHtml = replacePlaceholders(
    emailConfig.confirmationEmail.content,
    variables,
  );

  const internalSubject = body.product
    ? body.product.kind === 'cpo'
      ? `[CPO] Zapytanie o egzemplarz: ${body.product.brandName} ${body.product.name}`
      : `Zapytanie o produkt: ${body.product.brandName} ${body.product.name}`
    : `Nowe zgłoszenie z formularza kontaktowego`;

  const emails: TransactionalEmailInput[] = [
    {
      to: emailConfig.supportEmails.map((email) => ({ email })),
      subject: internalSubject,
      react: ContactNotificationTemplate({
        name: body.name,
        email: body.email,
        message: body.message,
        product: body.product,
      }),
      replyTo: body.email,
      saveToSentItems: true,
    },
    {
      to: { email: body.email, name: body.name },
      subject: confirmationSubject,
      react: ContactConfirmationTemplate({
        name: body.name,
        email: body.email,
        message: body.message,
        subject: confirmationSubject,
        htmlContent: confirmationContentHtml,
      }),
      replyTo: REPLY_TO_EMAIL,
      saveToSentItems: true,
    },
  ];

  try {
    const results = await sendTransactionalEmails(emails);
    const [internalResult, confirmationResult] = results;

    // Check if internal email succeeded (required)
    if (!internalResult?.success) {
      console.error(
        '[Contact API] Internal email failed:',
        internalResult?.error,
      );
      return NextResponse.json(
        { success: false, message: 'Failed to send notification email' },
        { status: 500 },
      );
    }

    // Log confirmation email result (optional, don't fail if it fails)
    if (!confirmationResult?.success) {
      console.error(
        '[Contact API] Confirmation email failed:',
        confirmationResult?.error,
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Contact API] Email sending failed', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send emails' },
      { status: 500 },
    );
  }
}
