import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendTransactionalEmail } from '@/src/global/email/service';
import { sanityFetch } from '@/src/global/sanity/fetch';

import { sendB2cCustomerTransactionalEmail } from './customer-transactional-email';

vi.mock('@/src/global/email/service', () => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('@/src/global/sanity/fetch', () => ({
  sanityFetch: vi.fn(),
}));

describe('sendB2cCustomerTransactionalEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendTransactionalEmail).mockResolvedValue({ success: true });
    vi.mocked(sanityFetch).mockResolvedValue(null);
  });

  it('injects configured Sanity copy recipients as BCC recipients', async () => {
    vi.mocked(sanityFetch).mockResolvedValue([
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
    vi.mocked(sanityFetch).mockRejectedValue(new Error('Sanity unavailable'));

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
