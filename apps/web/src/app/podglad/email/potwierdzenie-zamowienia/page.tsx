import type { Metadata } from 'next';

import { OrderConfirmationTemplate } from '@/src/emails/order-confirmation-template';
import {
  createEmailPreviewMetadata,
  EmailPreviewFrame,
} from '../_preview/email-preview';
import { orderConfirmationPreviewProps } from '../_preview/order-confirmation-preview';

export const metadata: Metadata = createEmailPreviewMetadata({
  title: 'Podgląd maila | Potwierdzenie zamówienia',
  description: 'Wewnętrzny podgląd maila potwierdzenia zamówienia.',
});

export default async function OrderConfirmationEmailPreviewPage() {
  return (
    <EmailPreviewFrame
      ariaLabel="Podgląd maila potwierdzenia zamówienia"
      email={OrderConfirmationTemplate(orderConfirmationPreviewProps)}
    />
  );
}
