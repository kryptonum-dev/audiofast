import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import CustomerAccountGateway from '@/src/components/b2c/CustomerAccountGateway';
import { resolveCustomerAccountReturnTo } from '@/src/global/b2c/customer-auth/return-to';
import { loadCustomerAuthSession } from '@/src/global/b2c/customer-auth/server/session';

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
  const [resolvedSearchParams, session] = await Promise.all([
    searchParams,
    loadCustomerAuthSession(),
  ]);
  const returnTo = resolveCustomerAccountReturnTo(
    resolvedSearchParams.returnTo,
  );

  if (session.isAuthenticated) {
    redirect(returnTo);
  }

  return (
    <main id="main" className="page-transition">
      <CustomerAccountGateway returnTo={returnTo} />
    </main>
  );
}
