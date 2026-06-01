import type { Metadata } from 'next';

import CustomerAccountDetailsPageContent from '@/src/components/b2c/CustomerPanel/AccountDetails';

export const metadata: Metadata = {
  title: 'Dane konta | Konto klienta | Audiofast',
  description:
    'Edycja domyślnych danych klienta wykorzystywanych przy przyszłych zamówieniach Audiofast.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function CustomerAccountDetailsPage() {
  return <CustomerAccountDetailsPageContent />;
}
