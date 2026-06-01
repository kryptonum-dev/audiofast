import type { Metadata } from 'next';

import CustomerAccountGateway from '@/src/components/b2c/CustomerAccountGateway';
import { resolveCustomerAccountReturnTo } from '@/src/global/b2c/customer-auth/return-to';

export const metadata: Metadata = {
  title: 'Konto klienta | Audiofast',
  description:
    'Zaloguj się do konta klienta Audiofast jednorazowym kodem wysłanym na adres e-mail z zamówienia.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

type CustomerAccountPageProps = {
  searchParams: Promise<{
    returnTo?: string | string[];
  }>;
};

export default async function CustomerAccountPage({
  searchParams,
}: CustomerAccountPageProps) {
  const resolvedSearchParams = await searchParams;
  const returnTo = resolveCustomerAccountReturnTo(
    resolvedSearchParams.returnTo,
  );

  return (
    <main id="main">
      <CustomerAccountGateway returnTo={returnTo} />
    </main>
  );
}
