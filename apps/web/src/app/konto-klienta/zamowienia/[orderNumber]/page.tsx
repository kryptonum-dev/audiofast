import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import CustomerPanelPlaceholder from '@/src/app/konto-klienta/CustomerPanelPlaceholder';
import { buildCustomerAccountGatewayHref } from '@/src/global/b2c/customer-auth/return-to';
import { loadCustomerAuthSession } from '@/src/global/b2c/customer-auth/server/session';

type CustomerOrderDetailsPageProps = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function generateMetadata({
  params,
}: CustomerOrderDetailsPageProps): Promise<Metadata> {
  const { orderNumber } = await params;

  return {
    title: `${orderNumber} | Zamówienie | Konto klienta | Audiofast`,
    description:
      'Miejsce na przyszły widok szczegółów zamówienia w panelu klienta Audiofast.',
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

export default async function CustomerOrderDetailsPage({
  params,
}: CustomerOrderDetailsPageProps) {
  const [{ orderNumber }, session] = await Promise.all([
    params,
    loadCustomerAuthSession(),
  ]);
  const orderDetailsHref = `/konto-klienta/zamowienia/${orderNumber}/`;

  if (!session.isAuthenticated) {
    redirect(buildCustomerAccountGatewayHref(orderDetailsHref));
  }

  return (
    <CustomerPanelPlaceholder
      eyebrow="Szczegóły zamówienia"
      heading={`Zamówienie ${orderNumber}`}
      description="Ta trasa jest już chroniona i gotowa na kolejny etap prac. W następnym kroku podłączymy tutaj pełny widok zamówienia, historię statusów oraz wszystkie dane zapisane w momencie zakupu."
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
