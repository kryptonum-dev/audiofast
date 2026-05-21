import 'server-only';

import { createElement } from 'react';

import { OrderReturnInstructionsTemplate } from '@/src/emails/order-return-instructions-template';
import { OrderReturnRequestAcknowledgmentTemplate } from '@/src/emails/order-return-request-acknowledgment-template';
import { buildB2cOrderDetailEmailUrl } from '@/src/global/b2c/email-urls';
import { loadB2cReturnInstructionsEmail } from '@/src/global/b2c/legal-documents/return-instructions';
import { sendB2cCustomerTransactionalEmail } from '@/src/global/b2c/customer-transactional-email';
import { getTransactionalReplyToEmail } from '@/src/global/email/service';
import type { SendEmailResult } from '@/src/global/microsoft-graph/client';

type ReturnEmailOrder = {
  customerEmail: string;
  customerFirstName: string;
  orderNumber: string;
};

export async function sendReturnRequestAcknowledgmentEmail(
  order: ReturnEmailOrder,
): Promise<SendEmailResult> {
  return sendB2cCustomerTransactionalEmail({
    react: createElement(OrderReturnRequestAcknowledgmentTemplate, {
      customerFirstName: order.customerFirstName,
      loginUrl: buildB2cOrderDetailEmailUrl(order.orderNumber),
      orderNumber: order.orderNumber,
    }),
    replyTo: getTransactionalReplyToEmail(),
    saveToSentItems: true,
    subject: `Otrzymaliśmy zgłoszenie zwrotu zamówienia ${order.orderNumber}`,
    to: {
      email: order.customerEmail,
      name: order.customerFirstName,
    },
  });
}

export async function sendReturnInstructionsEmail(
  order: ReturnEmailOrder,
): Promise<SendEmailResult> {
  const instructions = await loadB2cReturnInstructionsEmail();

  if (!instructions) {
    return {
      success: false,
      error: 'Return instruction email content is not configured in Sanity.',
    };
  }

  return sendB2cCustomerTransactionalEmail({
    react: createElement(OrderReturnInstructionsTemplate, {
      customerFirstName: order.customerFirstName,
      instructionsHtml: instructions.html,
      loginUrl: buildB2cOrderDetailEmailUrl(order.orderNumber),
      orderNumber: order.orderNumber,
    }),
    replyTo: getTransactionalReplyToEmail(),
    saveToSentItems: true,
    subject: `Instrukcja zwrotu zamówienia ${order.orderNumber}`,
    to: {
      email: order.customerEmail,
      name: order.customerFirstName,
    },
  });
}
