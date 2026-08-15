import { checkBotId } from 'botid/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  type ContentSignal,
  isSpamContent,
  scoreContent,
} from '@/global/anti-spam/content-score';
import { persistSubmission } from '@/global/anti-spam/submission-log';
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
  | 'botid'
  | 'spam-content'
  | 'honeypot'
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
  /** Logged for accepted submissions too, so the threshold can be tuned from real traffic */
  contentScore: number;
  contentSignals: ContentSignal[];
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
 * BotID plays two roles: a confident `isBot` verdict rejects outright (the
 * veto gate in POST below), and a confident `isHuman` verdict rescues a
 * honeypot trip (see honeypotConfirmed). Only confident verdicts act — an
 * unknown or errored verdict neither rejects nor vouches — so this function
 * can never throw: every failure path returns nulls, which downstream checks
 * read as "no verdict available".
 *
 * History of the direction. Until 2026-08-11 the honeypot required
 * `isBot === true` to reject, which meant an unknown verdict let everything
 * through, so 1b87e20 demoted BotID to vouch-only. The 2026-08-13/15 campaign
 * then proved the opposite failure: BotID returned `isBot: true` on all 249
 * logged bot requests — including the one that slid under the content-score
 * threshold and reached the inbox — while the vouch-only rule ignored it.
 * The lesson is not that `isBot` is unreliable, but that its ABSENCE is:
 * reject on `isBot === true`, never on `isBot !== false`.
 *
 * Vouching still matters for autofill: on the sister project BotID returned
 * `isHuman` for all six honeypot false positives, so those leads get through.
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
  const contentScore = scoreContent(body.name, body.message);

  const logContext = {
    honeypotTripped,
    // Truncated: enough to tell a browser autofill (a company name) from bot filler
    // text, without dumping arbitrary user input into the logs.
    honeypotValue: honeypotValue ? honeypotValue.slice(0, 32) : null,
    elapsedMs,
    botid,
    contentScore: contentScore.score,
    contentSignals: contentScore.signals,
    email: typeof body.email === 'string' ? body.email : null,
    ip: getClientIp(request),
    ua: request.headers.get('user-agent'),
    referer: request.headers.get('referer'),
  };

  // Two records per submission: the [BOTLOG] console line (gone from Vercel
  // within ~24h on the current plan) and a durable row in Supabase
  // `contact_submissions` — the place where a wrongly rejected human inquiry
  // can be spotted and recovered, which is what makes the strict gates below
  // safe to run. Persistence is best-effort and never changes the verdict.
  const recordSubmission = async (
    verdict: SubmissionVerdict,
    reason: SubmissionReason,
  ) => {
    logSubmission({ verdict, reason, ...logContext });

    await persistSubmission({
      verdict,
      reason,
      contentScore: contentScore.score,
      contentSignals: contentScore.signals,
      honeypotTripped,
      honeypotValue: logContext.honeypotValue,
      elapsedMs,
      botidIsBot: botid.isBot,
      botidIsHuman: botid.isHuman,
      email: logContext.email,
      ip: logContext.ip,
      userAgent: logContext.ua,
      referer: logContext.referer,
      name: typeof body.name === 'string' ? body.name : null,
      message: typeof body.message === 'string' ? body.message : null,
    });
  };

  // Every rejection returns the exact same status and payload, so a spammer
  // cannot tell bot detection apart from an ordinary validation failure
  const rejectSubmission = async (reason: SubmissionReason) => {
    await recordSubmission('rejected', reason);

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
   * A confident bot verdict rejects outright. In the 2026-08-14/15 log window
   * BotID flagged 249/249 bot requests (`isBot: true`) with zero human traffic
   * misclassified, while the bot mutated payloads until one slid under the
   * content-score threshold — this gate is what closes that adaptation route.
   * Only `isBot === true` rejects: unknown and errored verdicts pass through
   * to the content gates, and `bypassed` (the dev/E2E escape hatch) is
   * honoured. A wrongly vetoed human is recoverable from `contact_submissions`.
   */
  if (botid.isBot === true && botid.bypassed !== true) {
    return rejectSubmission('botid');
  }

  /**
   * Content heuristics reject on their own, with NO BotID veto.
   *
   * This is deliberate and differs from the honeypot rule below. The veto exists to
   * absorb browser autofill, and no browser autofills a message body with random
   * consonant runs — so a vouch here would buy no protection while disarming the one
   * check that works against a bot driving a real browser. Scoring is content-only,
   * so it holds whether or not the bot touches hidden fields or runs page JS.
   *
   * Thresholds penalise structure, never brevity: "Cena?" scores zero. See
   * content-score.ts and its tests for the calibration against real traffic.
   */
  if (isSpamContent(contentScore)) {
    return rejectSubmission('spam-content');
  }

  /**
   * A honeypot trip rejects unless BotID vouches for a human.
   *
   * On 2026-07-29 an unconditional version of this rule blocked two real B2B leads on
   * the sister project (Fabryka Atrakcji) — Chrome and Edge ignore `autocomplete="off"`
   * for address-profile autofill and filled the field for humans. That was fixed by
   * renaming the field to `ref2`, which no autofill heuristic classifies; the vouch is
   * the remaining insurance in case another heuristic starts matching it.
   *
   * `!== true` is the point: only a confident human verdict rescues a trip. An absent
   * or errored verdict no longer disarms the check, which is the bug this replaces.
   */
  const honeypotConfirmed = honeypotTripped && botid.isHuman !== true;

  if (honeypotConfirmed) {
    return rejectSubmission('honeypot');
  }

  // Humans cannot fill in and submit the form this fast
  if (elapsedMs !== null && elapsedMs < MIN_FILL_MS) {
    return rejectSubmission('too-fast');
  }

  await recordSubmission('accepted', 'passed-all-checks');

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
