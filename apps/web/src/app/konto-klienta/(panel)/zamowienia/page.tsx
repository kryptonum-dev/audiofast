import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import CustomerOrdersPageContent from '@/src/components/b2c/CustomerPanel/CustomerOrders/CustomerOrdersPageContent';
import type { CustomerOrdersSearchParams } from '@/src/global/b2c/customer-auth/orders-listing-query';
import { loadCustomerOrdersPageData } from '@/src/global/b2c/customer-auth/server/orders-page';

export const metadata: Metadata = {
  title: 'Zamówienia | Konto klienta | Audiofast',
  description:
    'Lista zamówień dostępnych po zalogowaniu do konta klienta Audiofast.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

type CustomerOrdersPageProps = {
  searchParams: Promise<CustomerOrdersSearchParams>;
};

export default async function CustomerOrdersPage({
  searchParams,
}: CustomerOrdersPageProps) {
  const pageData = await loadCustomerOrdersPageData();

  if (pageData.kind === 'unauthenticated') {
    redirect(pageData.redirectTo);
  }

  return (
    <CustomerOrdersPageContent
      normalizedEmail={pageData.normalizedEmail}
      searchParams={searchParams}
    />
  );
}
