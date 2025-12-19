/**
 * Microsoft Graph API Client - Email Service
 *
 * Uses client credentials flow for server-to-server authentication.
 * Sends emails from the configured shared mailbox (www@audiofast.pl).
 */

import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';

// Environment variables
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const MS_GRAPH_SENDER_EMAIL = process.env.MS_GRAPH_SENDER_EMAIL;

// Validate configuration
export function isGraphConfigured(): boolean {
  return !!(
    AZURE_TENANT_ID &&
    AZURE_CLIENT_ID &&
    AZURE_CLIENT_SECRET &&
    MS_GRAPH_SENDER_EMAIL
  );
}

// Lazy-initialized client (singleton pattern)
let graphClient: Client | null = null;

/**
 * Get or create the Microsoft Graph client
 */
function getGraphClient(): Client {
  if (graphClient) {
    return graphClient;
  }

  if (!isGraphConfigured()) {
    throw new Error(
      '[MS Graph] Missing required environment variables. ' +
        'Required: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, MS_GRAPH_SENDER_EMAIL'
    );
  }

  // Create credential using client secret
  const credential = new ClientSecretCredential(
    AZURE_TENANT_ID!,
    AZURE_CLIENT_ID!,
    AZURE_CLIENT_SECRET!
  );

  // Initialize Graph client with custom auth provider
  graphClient = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const tokenResponse = await credential.getToken(
          'https://graph.microsoft.com/.default'
        );
        return tokenResponse.token;
      },
    },
  });

  return graphClient;
}

// Email types
export type EmailRecipient = {
  email: string;
  name?: string;
};

export type SendEmailOptions = {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  htmlBody: string;
  replyTo?: string;
  saveToSentItems?: boolean;
};

export type SendEmailResult = {
  success: boolean;
  error?: string;
};

/**
 * Send an email using Microsoft Graph API
 *
 * @param options - Email options (to, subject, htmlBody, etc.)
 * @returns Promise with success status
 */
export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  try {
    const client = getGraphClient();
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    // Build the email message object
    const message: Record<string, unknown> = {
      subject: options.subject,
      body: {
        contentType: 'HTML',
        content: options.htmlBody,
      },
      toRecipients: recipients.map((r) => ({
        emailAddress: {
          address: r.email,
          name: r.name,
        },
      })),
    };

    // Add reply-to if specified
    if (options.replyTo) {
      message.replyTo = [
        {
          emailAddress: {
            address: options.replyTo,
          },
        },
      ];
    }

    // Send the email
    await client.api(`/users/${MS_GRAPH_SENDER_EMAIL}/sendMail`).post({
      message,
      saveToSentItems: options.saveToSentItems ?? true,
    });

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[MS Graph] Failed to send email:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send multiple emails concurrently
 *
 * @param emails - Array of email options
 * @returns Promise with array of results
 */
export async function sendEmails(
  emails: SendEmailOptions[]
): Promise<SendEmailResult[]> {
  const results = await Promise.allSettled(
    emails.map((email) => sendEmail(email))
  );

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      success: false,
      error: result.reason?.message || 'Unknown error',
    };
  });
}
