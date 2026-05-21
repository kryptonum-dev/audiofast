import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.fn();
const apiMock = vi.fn(() => ({
  post: postMock,
}));

vi.mock('@azure/identity', () => ({
  ClientSecretCredential: vi.fn(function ClientSecretCredential() {
    return {
      getToken: vi.fn(async () => ({ token: 'token' })),
    };
  }),
}));

vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    initWithMiddleware: vi.fn(() => ({
      api: apiMock,
    })),
  },
}));

describe('sendEmail', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('AZURE_CLIENT_ID', 'client-id');
    vi.stubEnv('AZURE_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('AZURE_TENANT_ID', 'tenant-id');
    vi.stubEnv('E2E_MOCK_EMAILS', '');
    vi.stubEnv('MS_GRAPH_SENDER_EMAIL', 'www@audiofast.pl');
    postMock.mockResolvedValue(undefined);
  });

  it('serializes CC and BCC recipients for Microsoft Graph', async () => {
    const { sendEmail } = await import('./client');

    await sendEmail({
      bcc: [{ email: 'zamowienia@audiofast.pl', name: 'Zamowienia' }],
      cc: { email: 'operator@audiofast.pl' },
      htmlBody: '<p>Test</p>',
      subject: 'Test',
      to: { email: 'customer@example.com', name: 'Customer' },
    });

    expect(apiMock).toHaveBeenCalledWith('/users/www@audiofast.pl/sendMail');
    expect(postMock).toHaveBeenCalledWith({
      message: expect.objectContaining({
        bccRecipients: [
          {
            emailAddress: {
              address: 'zamowienia@audiofast.pl',
              name: 'Zamowienia',
            },
          },
        ],
        ccRecipients: [
          {
            emailAddress: {
              address: 'operator@audiofast.pl',
              name: undefined,
            },
          },
        ],
      }),
      saveToSentItems: true,
    });
  });
});
