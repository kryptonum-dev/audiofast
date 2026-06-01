import type { Metadata } from 'next';

import ThankYouPageContent, {
  type ThankYouPageContentProps,
} from '../ThankYouPageContent';

export const metadata: Metadata = {
  title: 'Dziękujemy za zakup | Audiofast',
  description: 'Status płatności i zamówienia w Audiofast.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function ThankYouOrderPage(
  props: ThankYouPageContentProps,
) {
  return <ThankYouPageContent {...props} />;
}
