import 'server-only';

import { REGEX } from '@/src/global/constants';
import {
  sendTransactionalEmail,
  type TransactionalEmailInput,
} from '@/src/global/email/service';
import { sanityFetchPublished } from '@/src/global/sanity/live';
import { queryB2cTransactionalEmailCopyRecipients } from '@/src/global/sanity/query';
import type { QueryB2cTransactionalEmailCopyRecipientsResult } from '@/src/global/sanity/sanity.types';

export async function sendB2cCustomerTransactionalEmail(
  email: TransactionalEmailInput,
) {
  let bcc: { email: string }[] | undefined;

  try {
    const recipients =
      await sanityFetchPublished<QueryB2cTransactionalEmailCopyRecipientsResult>(
        {
          requestTag: 'b2c.email.copy-recipients',
          query: queryB2cTransactionalEmailCopyRecipients,
          tags: ['settings'],
        },
      );

    bcc = recipients
      ?.map((recipient) => recipient.trim().toLowerCase())
      .filter((recipient, index, allRecipients) => {
        return (
          recipient.length > 0 &&
          REGEX.email.test(recipient) &&
          allRecipients.indexOf(recipient) === index
        );
      })
      .map((recipient) => ({ email: recipient }));
  } catch (error) {
    console.error(
      '[B2C Email] Failed to load transactional email copy recipients.',
      error,
    );
  }

  return sendTransactionalEmail({
    ...email,
    bcc: bcc && bcc.length > 0 ? bcc : email.bcc,
  });
}
