import { checkBotId } from 'botid/server';
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

// Minimum time between form render and submit that we accept as human
const MIN_FILL_MS = 3000;

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
  /**
   * Honeypot. Deliberately named so no browser autofill heuristic can classify it —
   * the previous name `companyWebsite` matched Chromium's COMPANY_NAME regex on the
   * `company` substring, so Chrome/Edge filled it for real users. See honeypotConfirmed.
   */
  ref2?: string;
  /** Milliseconds between form render and submit, as reported by the client */
  elapsedMs?: number;
};

type SubmissionVerdict = 'accepted' | 'rejected';

type SubmissionReason =
  | 'honeypot+botid'
  | 'too-fast'
  | 'missing-email-or-consent'
  | 'passed-all-checks';

type BotIdVerdict = {
  isBot: boolean | null;
  isHuman: boolean | null;
  bypassed: boolean | null;
  headerPresent: boolean;
};

type SubmissionLogEntry = {
  verdict: SubmissionVerdict;
  reason: SubmissionReason;
  honeypotTripped: boolean;
  honeypotValue: string | null;
  elapsedMs: number | null;
  botid: BotIdVerdict;
  email: string | null;
  ip: string | null;
  ua: string | null;
  referer: string | null;
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

// `NextRequest.ip` was removed in Next.js 15+, so read the proxy headers instead
function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const firstForwardedIp = forwardedFor?.split(',')[0]?.trim();

  if (firstForwardedIp) return firstForwardedIp;

  return request.headers.get('x-real-ip');
}

/**
 * BotID never rejects on its own. It can only CONFIRM a honeypot trip — see
 * honeypotConfirmed below. A bot verdict with an empty honeypot is logged and let through.
 *
 * So: this function can never throw. Every failure path returns nulls, which the
 * `isBot === true` check downstream reads as "not a bot" and lets the submission through.
 * That fail-open posture is deliberate — a missing `x-is-human` header (ad blocker,
 * privacy extension, a submit that beat classification) is absence of evidence, not
 * evidence of a bot. Treating it as proof once cost the sister project three real leads.
 *
 * Before BotID is ever allowed to block by itself, check the [BOTLOG] lines for accepted
 * submissions where isBot=true — those would have been the false positives.
 */
async function getBotIdVerdict(request: NextRequest): Promise<BotIdVerdict> {
  const headerPresent = request.headers.has('x-is-human');
  const unknown: BotIdVerdict = {
    isBot: null,
    isHuman: null,
    bypassed: null,
    headerPresent,
  };

  try {
    const verification = await checkBotId({
      advancedOptions: { checkLevel: 'basic' },
    });

    return {
      isBot: verification?.isBot ?? null,
      isHuman: verification?.isHuman ?? null,
      bypassed: verification?.bypassed ?? null,
      headerPresent,
    };
  } catch (error) {
    console.error('[Contact API] BotID check failed', error);
    return unknown;
  }
}

// Server-side only - the verdict must never leak into the HTTP response
function logSubmission(entry: SubmissionLogEntry): void {
  console.info('[BOTLOG]', JSON.stringify(entry));
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

  // Anti-spam signals sent by the client alongside the form data
  const honeypotValue = typeof body.ref2 === 'string' ? body.ref2.trim() : '';
  const honeypotTripped = honeypotValue.length > 0;
  const elapsedMs = typeof body.elapsedMs === 'number' ? body.elapsedMs : null;
  const botid = await getBotIdVerdict(request);

  const logContext = {
    honeypotTripped,
    // Truncated: enough to tell a browser autofill (a company name) from bot filler
    // text, without dumping arbitrary user input into the logs.
    honeypotValue: honeypotValue ? honeypotValue.slice(0, 32) : null,
    elapsedMs,
    botid,
    email: typeof body.email === 'string' ? body.email : null,
    ip: getClientIp(request),
    ua: request.headers.get('user-agent'),
    referer: request.headers.get('referer'),
  };

  // Every rejection returns the exact same status and payload, so a spammer
  // cannot tell bot detection apart from an ordinary validation failure
  const rejectSubmission = (reason: SubmissionReason) => {
    logSubmission({ verdict: 'rejected', reason, ...logContext });

    return NextResponse.json(
      { success: false, message: 'Email and consent are required' },
      { status: 400 },
    );
  };

  // Validate required fields
  if (!body.email || !body.consent) {
    return rejectSubmission('missing-email-or-consent');
  }

  /**
   * The honeypot alone is NOT sufficient to reject.
   *
   * On 2026-07-29 the identical rule on the sister project (Fabryka Atrakcji) blocked
   * two real B2B leads — Chrome and Edge ignore `autocomplete="off"` for address-profile
   * autofill and filled the field for humans. Three of the four honeypot trips in that
   * observation window were false positives. BotID, meanwhile, was right 6/6 and said
   * `isHuman` for every one of them.
   *
   * So a honeypot trip only rejects when BotID independently agrees it is a bot. The
   * `=== true` is deliberate: a null/unknown verdict (BotID errored, header missing,
   * classification never ran) falls through to accept.
   */
  const honeypotConfirmed = honeypotTripped && botid.isBot === true;

  if (honeypotConfirmed) {
    return rejectSubmission('honeypot+botid');
  }

  // Humans cannot fill in and submit the form this fast
  if (elapsedMs !== null && elapsedMs < MIN_FILL_MS) {
    return rejectSubmission('too-fast');
  }

  logSubmission({
    verdict: 'accepted',
    reason: 'passed-all-checks',
    ...logContext,
  });

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
