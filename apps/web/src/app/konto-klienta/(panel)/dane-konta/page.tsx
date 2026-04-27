import type { Metadata } from 'next';

import CustomerPanelPlaceholder from '@/src/components/b2c/CustomerPanel/CustomerPanelPlaceholder';

export const metadata: Metadata = {
  title: 'Dane konta | Konto klienta | Audiofast',
  description:
    'Miejsce na przyszły widok danych konta w panelu klienta Audiofast.',
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
  return (
    <CustomerPanelPlaceholder
      eyebrow="Konto klienta"
      heading="Dane konta"
      description="Ta trasa jest już chroniona i gotowa na kolejny etap prac. W następnym kroku podłączymy tutaj edycję domyślnych danych klienta wykorzystywanych przy przyszłych zamówieniach."
      actions={[
        {
          href: '/konto-klienta/zamowienia/',
          label: 'Wróć do zamówień',
          iconUsed: 'arrowLeft',
          variant: 'secondary',
        },
      ]}
    />
  );
}
