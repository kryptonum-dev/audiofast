import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import type { CustomerOrdersSearchParams } from '@/src/global/b2c/customer-auth/orders-listing-query';
import { loadCustomerOrdersPageData } from '@/src/global/b2c/customer-auth/server/orders-page';

import CustomerOrdersListing from '../CustomerOrdersListing';
import CustomerOrdersListingSkeleton from '../CustomerOrdersListingSkeleton';
import { CustomerOrdersLoadingProvider } from '../CustomerOrdersLoadingContext';
import styles from './styles.module.scss';

const CUSTOMER_ORDERS_BASE_PATH = '/konto-klienta/zamowienia/';
const CUSTOMER_ORDERS_LISTING_ID = 'customer-orders-listing';

type CustomerOrdersPageContentProps = {
  searchParams: Promise<CustomerOrdersSearchParams>;
};

export default function CustomerOrdersPageContent({
  searchParams,
}: CustomerOrdersPageContentProps) {
  return (
    <CustomerOrdersLoadingProvider>
      <section className={styles.ordersPage}>
        <header className={styles.headingBlock}>
          <h1>Zamówienia</h1>
          <p className={styles.description}>
            Lista zamówień przypisanych do zweryfikowanego adresu e-mail.
            Wybierz pozycję z listy, aby zobaczyć szczegóły.
          </p>
        </header>

        <Suspense fallback={<CustomerOrdersListingSkeleton />}>
          <AuthenticatedCustomerOrdersListing searchParams={searchParams} />
        </Suspense>
      </section>
    </CustomerOrdersLoadingProvider>
  );
}

async function AuthenticatedCustomerOrdersListing({
  searchParams,
}: CustomerOrdersPageContentProps) {
  const pageData = await loadCustomerOrdersPageData();

  if (pageData.kind === 'unauthenticated') {
    redirect(pageData.redirectTo);
  }

  return (
    <CustomerOrdersListing
      normalizedEmail={pageData.normalizedEmail}
      searchParams={searchParams}
      basePath={CUSTOMER_ORDERS_BASE_PATH}
      scrollTargetId={CUSTOMER_ORDERS_LISTING_ID}
    />
  );
}
