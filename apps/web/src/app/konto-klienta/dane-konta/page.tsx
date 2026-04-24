import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import CustomerPanelPlaceholder from '@/src/app/konto-klienta/CustomerPanelPlaceholder';
import { buildCustomerAccountGatewayHref } from '@/src/global/b2c/customer-auth/return-to';
import { loadCustomerAuthSession } from '@/src/global/b2c/customer-auth/server/session';

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

export default async function CustomerAccountDetailsPage() {
  const session = await loadCustomerAuthSession();

  if (!session.isAuthenticated) {
    redirect(buildCustomerAccountGatewayHref('/konto-klienta/dane-konta/'));
  }

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
