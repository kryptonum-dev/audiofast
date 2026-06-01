import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import CustomerOrdersStateCard from '@/src/components/b2c/CustomerPanel/CustomerOrders/CustomerOrdersStateCard';
import CustomerOrderDetails from '@/src/components/b2c/CustomerPanel/OrderDetails';
import OrderDetailsSkeleton from '@/src/components/b2c/CustomerPanel/OrderDetails/OrderDetailsSkeleton';
import { buildCustomerAccountGatewayHref } from '@/src/global/b2c/customer-auth/return-to';
import { loadCustomerOrderForPanel } from '@/src/global/b2c/customer-auth/server/order-detail';
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
      'Szczegóły zamówienia dostępne po zalogowaniu do konta klienta Audiofast.',
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

export default function CustomerOrderDetailsPage({
  params,
}: CustomerOrderDetailsPageProps) {
  return (
    <Suspense fallback={<OrderDetailsSkeleton />}>
      <AuthenticatedCustomerOrderDetails params={params} />
    </Suspense>
  );
}

async function AuthenticatedCustomerOrderDetails({
  params,
}: CustomerOrderDetailsPageProps) {
  const { orderNumber } = await params;
  const detailPath = `/konto-klienta/zamowienia/${orderNumber}/`;
  const session = await loadCustomerAuthSession();

  if (!session.isAuthenticated) {
    redirect(buildCustomerAccountGatewayHref(detailPath));
  }

  const result = await loadCustomerOrderForPanel({
    orderNumber,
    normalizedEmail: session.normalizedEmail,
  });

  if (result.kind === 'not_found') {
    return (
      <CustomerOrdersStateCard
        live
        heading="Nie możemy pokazać tego zamówienia"
        description="Zamówienie nie istnieje, nie należy do zalogowanego adresu e-mail albo nie jest już dostępne w panelu klienta."
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

  return <CustomerOrderDetails order={result.order} />;
}
