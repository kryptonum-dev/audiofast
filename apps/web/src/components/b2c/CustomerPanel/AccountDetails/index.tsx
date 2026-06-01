import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import CustomerOrdersStateCard from '@/src/components/b2c/CustomerPanel/CustomerOrders/CustomerOrdersStateCard';
import { buildCustomerAccountGatewayHref } from '@/src/global/b2c/customer-auth/return-to';
import { loadCustomerAccountProfileForPanel } from '@/src/global/b2c/customer-auth/server/customer-account-profile';
import { loadCustomerAuthSession } from '@/src/global/b2c/customer-auth/server/session';

import AccountDetailsSkeleton from './AccountDetailsSkeleton';
import CustomerAccountDetailsForm from './CustomerAccountDetailsForm';
import styles from './styles.module.scss';

export default function CustomerAccountDetailsPageContent() {
  return (
    <section className={styles.accountDetailsPage}>
      <CustomerAccountDetailsHeader />

      <Suspense fallback={<AccountDetailsSkeleton />}>
        <AuthenticatedCustomerAccountDetailsForm />
      </Suspense>
    </section>
  );
}

export function CustomerAccountDetailsHeader() {
  return (
    <header className={styles.headingBlock}>
      <h1>Dane konta</h1>
      <p className={styles.description}>
        Zarządzaj domyślnymi danymi kontaktowymi, dostawy i firmy dla przyszłych
        zamówień. Zmiany nie wpływają na historię zamówień.
      </p>
    </header>
  );
}

async function AuthenticatedCustomerAccountDetailsForm() {
  const session = await loadCustomerAuthSession();

  if (!session.isAuthenticated) {
    redirect(buildCustomerAccountGatewayHref('/konto-klienta/dane-konta/'));
  }

  let result: Awaited<ReturnType<typeof loadCustomerAccountProfileForPanel>>;

  try {
    result = await loadCustomerAccountProfileForPanel({
      authUserId: session.authUser.id,
      normalizedEmail: session.normalizedEmail,
    });
  } catch (error) {
    console.error('Failed to load customer account profile page.', error);

    return (
      <CustomerOrdersStateCard
        live
        heading="Nie możemy załadować danych konta"
        description="Spróbuj odświeżyć stronę za chwilę. Jeśli problem będzie się powtarzał, wróć do zamówień i skontaktuj się z Audiofast."
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

  if (result.kind === 'not_found') {
    return (
      <CustomerOrdersStateCard
        live
        heading="Nie znaleźliśmy danych konta"
        description="Ten panel pokazuje dane utworzone podczas zamówień. Po pierwszym kwalifikującym się zakupie będzie można edytować tutaj domyślne dane do kolejnych zamówień."
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

  return <CustomerAccountDetailsForm profile={result.profile} />;
}
