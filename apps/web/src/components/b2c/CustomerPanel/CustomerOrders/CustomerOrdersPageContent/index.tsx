import { Suspense } from 'react';

import type { CustomerOrdersSearchParams } from '@/src/global/b2c/customer-auth/orders-listing-query';

import CustomerOrdersListing from '../CustomerOrdersListing';
import CustomerOrdersListingSkeleton from '../CustomerOrdersListingSkeleton';
import { CustomerOrdersLoadingProvider } from '../CustomerOrdersLoadingContext';
import styles from './styles.module.scss';

const CUSTOMER_ORDERS_BASE_PATH = '/konto-klienta/zamowienia/';
const CUSTOMER_ORDERS_LISTING_ID = 'customer-orders-listing';

type CustomerOrdersPageContentProps = {
  normalizedEmail: string;
  searchParams: Promise<CustomerOrdersSearchParams>;
};

export default function CustomerOrdersPageContent({
  normalizedEmail,
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
          <CustomerOrdersListing
            normalizedEmail={normalizedEmail}
            searchParams={searchParams}
            basePath={CUSTOMER_ORDERS_BASE_PATH}
            scrollTargetId={CUSTOMER_ORDERS_LISTING_ID}
          />
        </Suspense>
      </section>
    </CustomerOrdersLoadingProvider>
  );
}
