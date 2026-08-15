import { checkBotId } from 'botid/server';
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { persistSubmission } from '@/global/anti-spam/submission-log';
import { FALLBACK_SUPPORT_EMAIL } from '@/global/constants';
import { sendTransactionalEmails } from '@/src/global/email/service';
import { isGraphConfigured } from '@/src/global/microsoft-graph/client';
import { sanityFetch } from '@/src/global/sanity/fetch';
import type { QueryContactSettingsResult } from '@/src/global/sanity/sanity.types';

import { POST } from './route';

vi.mock('botid/server', () => ({
  checkBotId: vi.fn(),
}));

vi.mock('@/global/anti-spam/submission-log', () => ({
  persistSubmission: vi.fn(async () => undefined),
}));

vi.mock('@/src/global/email/service', () => ({
  sendTransactionalEmails: vi.fn(),
}));

vi.mock('@/src/global/microsoft-graph/client', () => ({
  isGraphConfigured: vi.fn(),
}));

vi.mock('@/src/global/sanity/fetch', () => ({
  sanityFetch: vi.fn(),
}));

vi.mock('@/src/emails/contact-confirmation-template', () => ({
  ContactConfirmationTemplate: vi.fn(() => null),
}));

vi.mock('@/src/emails/contact-notification-template', () => ({
  ContactNotificationTemplate: vi.fn(() => null),
}));

function createContactSettings(
  supportEmails: string[] | null,
): QueryContactSettingsResult {
  return {
    supportEmails,
    confirmationEmail: {
      subject: 'Dziekujemy za kontakt',
      content: null,
    },
  };
}

function createContactRequest(body: Record<string, unknown>): NextRequest {
  return new Request('https://audiofast.pl/api/contact', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as NextRequest;
}

/** No verdict available — the common production case at `checkLevel: 'basic'`. */
function botIdUnknown() {
  vi.mocked(checkBotId).mockResolvedValue({
    isBot: false,
    isHuman: false,
    isVerifiedBot: false,
    bypassed: false,
  } as Awaited<ReturnType<typeof checkBotId>>);
}

/** BotID positively vouches for a human — the autofill-rescue path. */
function botIdVouchesHuman() {
  vi.mocked(checkBotId).mockResolvedValue({
    isBot: false,
    isHuman: true,
    isVerifiedBot: false,
    bypassed: false,
  } as Awaited<ReturnType<typeof checkBotId>>);
}

/** BotID confidently flags a bot — the verdict on all 249 requests of the 2026-08 campaign. */
function botIdFlagsBot(bypassed = false) {
  vi.mocked(checkBotId).mockResolvedValue({
    isBot: true,
    isHuman: false,
    isVerifiedBot: false,
    bypassed,
  } as Awaited<ReturnType<typeof checkBotId>>);
}

describe('contact API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isGraphConfigured).mockReturnValue(true);
    vi.mocked(sanityFetch).mockResolvedValue(createContactSettings([]));
    botIdUnknown();
    vi.mocked(sendTransactionalEmails).mockResolvedValue([
      { success: true },
      { success: true },
    ]);
  });

  it('sends product inquiry notifications to configured Sanity support emails', async () => {
    vi.mocked(sanityFetch).mockResolvedValue(
      createContactSettings([
        ' Sprzedaz@audiofast.pl ',
        'sprzedaz@audiofast.pl',
        'support@audiofast.pl',
      ]),
    );

    const response = await POST(
      createContactRequest({
        name: 'Jan Kowalski',
        email: 'jan@example.com',
        consent: true,
        message: 'Prosze o kontakt.',
        product: {
          name: 'Model X',
          brandName: 'Audio Brand',
          kind: 'standard',
          configuration: [],
          basePrice: null,
          totalPrice: null,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(sendTransactionalEmails).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          to: [
            { email: 'sprzedaz@audiofast.pl' },
            { email: 'support@audiofast.pl' },
          ],
          subject: 'Zapytanie o produkt: Audio Brand Model X',
        }),
      ]),
    );
  });

  it('falls back to the configured sender fallback when Sanity has no recipients', async () => {
    vi.mocked(sanityFetch).mockResolvedValue(createContactSettings([]));

    const response = await POST(
      createContactRequest({
        name: 'Jan Kowalski',
        email: 'jan@example.com',
        consent: true,
        message: 'Prosze o kontakt.',
      }),
    );

    expect(response.status).toBe(200);
    expect(sendTransactionalEmails).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          to: [{ email: FALLBACK_SUPPORT_EMAIL.trim().toLowerCase() }],
          subject: 'Nowe zgłoszenie z formularza kontaktowego',
        }),
      ]),
    );
  });

  describe('anti-spam gates', () => {
    const legitimate = {
      name: 'Jan Kowalski',
      email: 'jan@example.com',
      consent: true,
      message: 'Prosze o kontakt w sprawie Ayre KX-8.',
    };

    it('accepts a legitimate submission when BotID has no verdict', async () => {
      // The regression case: an absent verdict must not block real leads
      const response = await POST(createContactRequest(legitimate));

      expect(response.status).toBe(200);
      expect(sendTransactionalEmails).toHaveBeenCalled();
    });

    it('rejects when BotID confidently flags a bot, even with clean content', async () => {
      // The 2026-08-15 00:15 acceptance: content mutated below the score
      // threshold, honeypot untouched, timing waited out — and BotID said
      // isBot on that request too. The veto closes that adaptation route.
      botIdFlagsBot();

      const response = await POST(createContactRequest(legitimate));

      expect(response.status).toBe(400);
      expect(sendTransactionalEmails).not.toHaveBeenCalled();
    });

    it('honours the BotID bypass escape hatch', async () => {
      // Local dev and E2E runs set the bypass; they must not be vetoed
      botIdFlagsBot(true);

      const response = await POST(createContactRequest(legitimate));

      expect(response.status).toBe(200);
      expect(sendTransactionalEmails).toHaveBeenCalled();
    });

    it('rejects the captured 2026-08-13 spam payload on content alone', async () => {
      // Defence in depth: even with no BotID verdict, the uppercase-run
      // variant that reached the inbox on 2026-08-13 must not pass again
      const response = await POST(
        createContactRequest({
          name: 'mKIHYDnOYBLMXjYWPfYIK',
          email: 'jrangel@bcew.com',
          consent: true,
          message: 'wQyJPSVQuhsUbxarkxO',
        }),
      );

      expect(response.status).toBe(400);
      expect(sendTransactionalEmails).not.toHaveBeenCalled();
    });

    it('rejects the captured 2026-08-09 spam payload', async () => {
      const response = await POST(
        createContactRequest({
          name: 'afHZeUWfAEaGHPZuSj',
          email: 'olaf.tillema@yoobi.nl',
          consent: true,
          message: 'uUeOyBQwSCXYwfgIhXaus',
        }),
      );

      expect(response.status).toBe(400);
      expect(sendTransactionalEmails).not.toHaveBeenCalled();
    });

    it('rejects gibberish even when BotID vouches for a human', async () => {
      // Content scoring is deliberately un-vetoable: no browser autofills a
      // message body, so a vouch here would only disarm the check.
      botIdVouchesHuman();

      const response = await POST(
        createContactRequest({
          name: 'afHZeUWfAEaGHPZuSj',
          email: 'olaf.tillema@yoobi.nl',
          consent: true,
          message: 'uUeOyBQwSCXYwfgIhXaus',
        }),
      );

      expect(response.status).toBe(400);
      expect(sendTransactionalEmails).not.toHaveBeenCalled();
    });

    it('rejects a honeypot trip when BotID offers no verdict', async () => {
      // This is what broke between 2026-08-03 and 2026-08-11: the old rule
      // required isBot === true, so an unknown verdict accepted the submission.
      const response = await POST(
        createContactRequest({ ...legitimate, ref2: 'http://spam.example' }),
      );

      expect(response.status).toBe(400);
      expect(sendTransactionalEmails).not.toHaveBeenCalled();
    });

    it('lets a honeypot trip through when BotID vouches for a human', async () => {
      // Browser autofill rescue - the Fabryka Atrakcji false-positive path
      botIdVouchesHuman();

      const response = await POST(
        createContactRequest({ ...legitimate, ref2: 'Audiofast Sp. z o.o.' }),
      );

      expect(response.status).toBe(200);
      expect(sendTransactionalEmails).toHaveBeenCalled();
    });

    it('rejects submissions faster than a human can fill the form', async () => {
      const response = await POST(
        createContactRequest({ ...legitimate, elapsedMs: 400 }),
      );

      expect(response.status).toBe(400);
      expect(sendTransactionalEmails).not.toHaveBeenCalled();
    });

    it('accepts when the timing signal is absent', async () => {
      // Fail-open on absence is deliberate; the honeypot has no such escape hatch
      const response = await POST(createContactRequest(legitimate));

      expect(response.status).toBe(200);
    });

    it('returns an identical response for every rejection reason', async () => {
      // A spammer must not be able to tell detection from ordinary validation
      const bodies = [
        { ...legitimate, ref2: 'http://spam.example' },
        { ...legitimate, elapsedMs: 400 },
        {
          ...legitimate,
          name: 'afHZeUWfAEaGHPZuSj',
          message: 'uUeOyBQwSCXYwfgIhXaus',
        },
        { ...legitimate, email: '' },
      ];

      const payloads = await Promise.all(
        bodies.map(async (body) => {
          const response = await POST(createContactRequest(body));
          return { status: response.status, body: await response.json() };
        }),
      );

      for (const payload of payloads) {
        expect(payload).toEqual(payloads[0]);
      }
    });
  });

  describe('durable submission log', () => {
    const legitimate = {
      name: 'Jan Kowalski',
      email: 'jan@example.com',
      consent: true,
      message: 'Prosze o kontakt w sprawie Ayre KX-8.',
    };

    it('persists accepted submissions with the submitted content', async () => {
      await POST(createContactRequest(legitimate));

      expect(persistSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          verdict: 'accepted',
          reason: 'passed-all-checks',
          name: 'Jan Kowalski',
          message: 'Prosze o kontakt w sprawie Ayre KX-8.',
          email: 'jan@example.com',
        }),
      );
    });

    it('persists rejected submissions with the real reason and content', async () => {
      // The row is what lets a human review rejections for false positives -
      // it must carry the content even though the HTTP response hides the reason
      botIdFlagsBot();

      await POST(createContactRequest(legitimate));

      expect(persistSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          verdict: 'rejected',
          reason: 'botid',
          name: 'Jan Kowalski',
          botidIsBot: true,
        }),
      );
    });
  });
});
