import {
  CUSTOMER_ORDERS_ITEMS_PER_PAGE,
  type CustomerOrdersSearchParams,
  parseCustomerOrdersPage,
  parseCustomerOrdersSortBy,
} from '@/src/global/b2c/customer-auth/orders-listing-query';
import { loadCustomerOrdersForPanel } from '@/src/global/b2c/customer-auth/server/orders';

import CustomerOrderCard from '../CustomerOrderCard';
import CustomerOrdersListingContainer from '../CustomerOrdersListingContainer';
import CustomerOrdersPagination from '../CustomerOrdersPagination';
import CustomerOrdersSortDropdown from '../CustomerOrdersSortDropdown';
import CustomerOrdersStateCard from '../CustomerOrdersStateCard';
import styles from './styles.module.scss';

type CustomerOrdersListingProps = {
  normalizedEmail: string;
  searchParams: Promise<CustomerOrdersSearchParams>;
  basePath: string;
  scrollTargetId?: string;
};

export default async function CustomerOrdersListing({
  normalizedEmail,
  searchParams,
  basePath,
  scrollTargetId,
}: CustomerOrdersListingProps) {
  const params = await searchParams;
  const currentPage = parseCustomerOrdersPage(params.page);
  const sortBy = parseCustomerOrdersSortBy(params.sortBy);

  try {
    const result = await loadCustomerOrdersForPanel({
      normalizedEmail,
      page: currentPage,
      pageSize: CUSTOMER_ORDERS_ITEMS_PER_PAGE,
      sortBy,
    });

    const paginationSearchParams = new URLSearchParams();

    if (result.sortBy !== 'newest') {
      paginationSearchParams.set('sortBy', result.sortBy);
    }

    if (result.orders.length === 0) {
      return (
        <CustomerOrdersStateCard
          heading="Brak zamówień do wyświetlenia"
          description="Po zalogowaniu pokazujemy tylko zamówienia aktywne lub zakończone. Złóż swoje pierwsze zamówienie, aby pojawiło się w tym miejscu."
          actions={[
            {
              href: '/produkty/',
              label: 'Przejdź do sklepu',
              variant: 'primary',
              iconUsed: 'arrowRight',
            },
          ]}
        />
      );
    }

    const firstOrderId = result.orders[0]?.id ?? 'none';
    const lastOrderId = result.orders.at(-1)?.id ?? 'none';
    const listingSignature = [
      result.currentPage,
      result.sortBy,
      result.totalCount,
      firstOrderId,
      lastOrderId,
    ].join(':');

    return (
      <CustomerOrdersListingContainer
        listingSignature={listingSignature}
        visibleItemCount={result.orders.length}
      >
        <div className={styles.controlsRow} id={scrollTargetId}>
          <CustomerOrdersSortDropdown basePath={basePath} />
          <CustomerOrdersPagination
            totalItems={result.totalCount}
            itemsPerPage={result.pageSize}
            currentPage={result.currentPage}
            basePath={basePath}
            searchParams={paginationSearchParams}
            scrollTargetId={scrollTargetId}
          />
        </div>
        <ul className={styles.orderList}>
          {result.orders.map((order, index) => (
            <CustomerOrderCard
              key={order.id}
              order={order}
              priority={index === 0}
            />
          ))}
        </ul>
        <CustomerOrdersPagination
          totalItems={result.totalCount}
          itemsPerPage={result.pageSize}
          currentPage={result.currentPage}
          basePath={basePath}
          searchParams={paginationSearchParams}
          scrollTargetId={scrollTargetId}
        />
      </CustomerOrdersListingContainer>
    );
  } catch (error) {
    console.error('Failed to load customer orders listing.', error);

    return (
      <CustomerOrdersStateCard
        live
        heading="Nie udało się załadować listy zamówień"
        description="Spróbuj odświeżyć stronę. Jeśli problem będzie się powtarzał, zaloguj się ponownie."
        actions={[
          {
            href: '/konto-klienta/',
            label: 'Wróć do logowania',
            variant: 'secondary',
            iconUsed: 'arrowLeft',
          },
        ]}
      />
    );
  }
}
