import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendTransactionalEmail } from '@/src/global/email/service';
import { sanityFetchPublished } from '@/src/global/sanity/live';

import { sendB2cCustomerTransactionalEmail } from './customer-transactional-email';

vi.mock('@/src/global/email/service', () => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('@/src/global/sanity/live', () => ({
  sanityFetchPublished: vi.fn(),
}));

describe('sendB2cCustomerTransactionalEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendTransactionalEmail).mockResolvedValue({ success: true });
    vi.mocked(sanityFetchPublished).mockResolvedValue(null);
  });

  it('injects configured Sanity copy recipients as BCC recipients', async () => {
    vi.mocked(sanityFetchPublished).mockResolvedValue([
      ' zamowienia@audiofast.pl ',
      'ZAMOWIENIA@audiofast.pl',
      'not-an-email',
      'archiwum@audiofast.pl',
    ]);

    await sendB2cCustomerTransactionalEmail({
      react: <div>Test</div>,
      subject: 'Test',
      to: { email: 'customer@example.com' },
    });

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        bcc: [
          { email: 'zamowienia@audiofast.pl' },
          { email: 'archiwum@audiofast.pl' },
        ],
      }),
    );
  });

  it('does not block customer delivery when Sanity settings cannot be loaded', async () => {
    vi.mocked(sanityFetchPublished).mockRejectedValue(
      new Error('Sanity unavailable'),
    );

    await sendB2cCustomerTransactionalEmail({
      react: <div>Test</div>,
      subject: 'Test',
      to: { email: 'customer@example.com' },
    });

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        bcc: undefined,
        to: { email: 'customer@example.com' },
      }),
    );
  });
});
