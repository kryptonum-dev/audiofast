import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

import {
  FALLBACK_EMAIL_BODY,
  FALLBACK_EMAIL_SUBJECT,
  FALLBACK_SUPPORT_EMAIL,
} from '@/global/constants';
import { sanityFetch } from '@/global/sanity/fetch';
import { queryContactSettings } from '@/global/sanity/query';
import type { QueryContactSettingsResult } from '@/global/sanity/sanity.types';
import type { PortableTextProps } from '@/global/types';
import { portableTextToHtml } from '@/global/utils';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || FALLBACK_SUPPORT_EMAIL;
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO;

type FormSubmission = {
  name?: string;
  email: string;
  message?: string;
  consent: boolean;
};

type ContactSettingsType = {
  supportEmails: string[];
  confirmationEmail: {
    subject: string;
    content: string;
  };
};

// Get contact settings with fallbacks
function getContactConfig(
  contactSettings: NonNullable<QueryContactSettingsResult>
): ContactSettingsType {
  // Use fallback if contact settings are not available

  const supportEmails = contactSettings.supportEmails || [
    FALLBACK_SUPPORT_EMAIL,
  ];

  const subject =
    contactSettings.confirmationEmail?.subject || FALLBACK_EMAIL_SUBJECT;
  const content =
    portableTextToHtml(
      contactSettings.confirmationEmail?.content as PortableTextProps
    ) || FALLBACK_EMAIL_BODY;

  return {
    supportEmails,
    confirmationEmail: {
      subject,
      content,
    },
  };
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

// Replace placeholders in text
function replacePlaceholders(
  text: string,
  variables: { name?: string; email?: string; message?: string }
): string {
  return text
    .replace(/\{\{name\}\}/g, escapeHtml(variables.name || ''))
    .replace(/\{\{email\}\}/g, escapeHtml(variables.email || ''))
    .replace(/\{\{message\}\}/g, escapeHtml(variables.message || ''));
}

// Create email HTML wrapper
function createEmailHTML(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${body}
</body>
</html>
  `.trim();
}

export async function POST(request: NextRequest) {
  // Validate Resend is configured
  if (!RESEND_API_KEY) {
    console.error('[Contact API] RESEND_API_KEY not configured');
    return NextResponse.json(
      { success: false, message: 'Email service not configured' },
      { status: 500 }
    );
  }

  // Parse request body
  let body: FormSubmission;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON' },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.email || !body.consent) {
    return NextResponse.json(
      { success: false, message: 'Email and consent are required' },
      { status: 400 }
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

  const emailConfig = getContactConfig(contactSettings!);

  // Initialize Resend
  const resend = new Resend(RESEND_API_KEY);

  // Prepare variables for template replacement
  const variables = {
    name: body.name || '',
    email: body.email,
    message: body.message || '',
  };

  // Render confirmation email content
  const confirmationSubject = replacePlaceholders(
    emailConfig.confirmationEmail.subject,
    variables
  );
  const confirmationBody = replacePlaceholders(
    emailConfig.confirmationEmail.content,
    variables
  );

  // Build internal notification email
  const internalSubject = `Nowe zgłoszenie z formularza kontaktowego`;
  const internalBody = `
    <h2>Nowe zgłoszenie z formularza</h2>
    ${body.name ? `<p><strong>Imię i nazwisko:</strong> ${escapeHtml(body.name)}</p>` : ''}
    <p><strong>E-mail:</strong> ${escapeHtml(body.email)}</p>
    ${body.message ? `<p><strong>Wiadomość:</strong><br>${escapeHtml(body.message).replace(/\n/g, '<br>')}</p>` : ''}

  `;

  // Send emails concurrently
  try {
    const [confirmationResult, internalResult] = await Promise.allSettled([
      // Internal notification email
      resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: emailConfig.supportEmails,
        replyTo: body.email,
        subject: internalSubject,
        html: createEmailHTML(internalBody),
      }),
      // Confirmation email
      resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: body.email,
        replyTo: RESEND_REPLY_TO,
        subject: confirmationSubject,
        html: createEmailHTML(confirmationBody),
      }),
    ]);

    // // Check if internal email succeeded (required)
    if (internalResult.status === 'rejected') {
      console.error(
        '[Contact API] Internal email failed',
        internalResult.reason
      );
      return NextResponse.json(
        { success: false, message: 'Failed to send notification email' },
        { status: 500 }
      );
    }

    // Log confirmation email result (optional, don't fail if it fails)
    if (confirmationResult.status === 'rejected') {
      console.error(
        '[Contact API] Confirmation email failed',
        confirmationResult.reason
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Contact API] Email sending failed', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send emails' },
      { status: 500 }
    );
  }
}
