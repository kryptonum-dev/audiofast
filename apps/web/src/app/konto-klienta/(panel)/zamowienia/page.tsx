import type { Metadata } from 'next';

import CustomerOrdersPageContent from '@/src/components/b2c/CustomerPanel/CustomerOrders/CustomerOrdersPageContent';
import type { CustomerOrdersSearchParams } from '@/src/global/b2c/customer-auth/orders-listing-query';

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

export default function CustomerOrdersPage({
  searchParams,
}: CustomerOrdersPageProps) {
  return <CustomerOrdersPageContent searchParams={searchParams} />;
}
