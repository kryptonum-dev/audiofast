import 'server-only';

import { render } from '@react-email/render';
import type { ReactElement } from 'react';

import {
  sendEmail,
  type SendEmailOptions,
  type SendEmailResult,
  sendEmails,
} from '@/src/global/microsoft-graph/client';

export type TransactionalEmailInput = Omit<SendEmailOptions, 'htmlBody'> & {
  react: ReactElement;
};

export function getTransactionalReplyToEmail(): string | undefined {
  return process.env.MS_GRAPH_REPLY_TO || process.env.MS_GRAPH_SENDER_EMAIL;
}

async function renderTransactionalEmail(react: ReactElement): Promise<string> {
  return render(react);
}

export async function sendTransactionalEmail(
  email: TransactionalEmailInput,
): Promise<SendEmailResult> {
  const htmlBody = await renderTransactionalEmail(email.react);

  return sendEmail({
    to: email.to,
    subject: email.subject,
    htmlBody,
    attachments: email.attachments,
    replyTo: email.replyTo,
    saveToSentItems: email.saveToSentItems,
  });
}

export async function sendTransactionalEmails(
  emails: TransactionalEmailInput[],
): Promise<SendEmailResult[]> {
  const renderedEmails = await Promise.all(
    emails.map(async (email) => ({
      attachments: email.attachments,
      to: email.to,
      subject: email.subject,
      htmlBody: await renderTransactionalEmail(email.react),
      replyTo: email.replyTo,
      saveToSentItems: email.saveToSentItems,
    })),
  );

  return sendEmails(renderedEmails);
}
