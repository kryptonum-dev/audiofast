import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FALLBACK_SUPPORT_EMAIL } from '@/global/constants';
import { sendTransactionalEmails } from '@/src/global/email/service';
import { isGraphConfigured } from '@/src/global/microsoft-graph/client';
import { sanityFetch } from '@/src/global/sanity/fetch';
import type { QueryContactSettingsResult } from '@/src/global/sanity/sanity.types';

import { POST } from './route';

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

describe('contact API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isGraphConfigured).mockReturnValue(true);
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
});
