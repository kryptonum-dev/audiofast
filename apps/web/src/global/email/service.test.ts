import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendEmail } from '@/src/global/microsoft-graph/client';

import { sendTransactionalEmail } from './service';

vi.mock('@react-email/render', () => ({
  render: vi.fn(async () => '<p>Rendered</p>'),
}));

vi.mock('@/src/global/microsoft-graph/client', () => ({
  sendEmail: vi.fn(),
}));

describe('sendTransactionalEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendEmail).mockResolvedValue({ success: true });
  });

  it('passes BCC recipients through to the Microsoft Graph email client', async () => {
    await sendTransactionalEmail({
      bcc: [{ email: 'zamowienia@audiofast.pl' }],
      react: createElement('div', null, 'Test'),
      subject: 'Test',
      to: { email: 'customer@example.com' },
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        bcc: [{ email: 'zamowienia@audiofast.pl' }],
      }),
    );
  });
});
