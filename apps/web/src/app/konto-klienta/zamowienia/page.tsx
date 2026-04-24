import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { logoutCustomerAuthAction } from '@/src/app/actions/customer-auth-logout';
import Button from '@/src/components/ui/Button';
import { buildCustomerAccountGatewayHref } from '@/src/global/b2c/customer-auth/return-to';
import {
  type CustomerOrdersListItem,
  loadCustomerOrdersForPanel,
} from '@/src/global/b2c/customer-auth/server/orders';
import { loadCustomerAuthSession } from '@/src/global/b2c/customer-auth/server/session';

import styles from './styles.module.scss';

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

function formatOrderDate(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatPrice(valueInCents: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(valueInCents / 100);
}

function getOrderStatusLabel(order: CustomerOrdersListItem): string {
  if (order.currentStatus === 'awaiting_payment') {
    return 'Oczekuje na płatność';
  }

  switch (order.currentStatus) {
    case 'paid':
      return 'Opłacone';
    case 'processing':
      return 'W realizacji';
    case 'shipped':
      return 'Wysłane';
    case 'completed':
      return 'Zakończone';
    case 'cancelled':
      return 'Anulowane';
    case 'returned':
      return 'Zwrócone';
    default:
      return order.currentStatus;
  }
}

function getOrderStatusTone(
  order: CustomerOrdersListItem,
): 'success' | 'neutral' | 'warning' {
  if (
    order.currentStatus === 'paid' ||
    order.currentStatus === 'completed' ||
    order.currentStatus === 'shipped'
  ) {
    return 'success';
  }

  if (order.currentStatus === 'awaiting_payment') {
    return 'warning';
  }

  return 'neutral';
}

async function loadOrdersPageData() {
  const session = await loadCustomerAuthSession();

  if (!session.isAuthenticated) {
    redirect(buildCustomerAccountGatewayHref('/konto-klienta/zamowienia/'));
  }

  try {
    const orders = await loadCustomerOrdersForPanel(session.normalizedEmail);

    return {
      session,
      orders,
      hasLoadError: false,
    };
  } catch (error) {
    console.error('Failed to load customer orders page.', error);

    return {
      session,
      orders: [],
      hasLoadError: true,
    };
  }
}

export default async function CustomerOrdersPage() {
  const pageData = await loadOrdersPageData();

  return (
    <main id="main" className="page-transition">
      <section className={styles.ordersPage}>
        <div className={`max-width ${styles.inner}`}>
          <div className={styles.topBar}>
            <div className={styles.headingBlock}>
              <h1 className={styles.heading}>Zamówienia</h1>
              <p className={styles.description}>
                Zalogowano jako{' '}
                <strong>{pageData.session.normalizedEmail}</strong>. Tutaj
                znajdziesz zamówienia przypisane do tego adresu e-mail.
              </p>
            </div>

            <form
              action={logoutCustomerAuthAction}
              className={styles.logoutForm}
            >
              <button type="submit" className={styles.logoutButton}>
                Wyloguj się
              </button>
            </form>
          </div>

          {pageData.hasLoadError ? (
            <section className={styles.stateCard}>
              <h2 className={styles.stateHeading}>
                Nie udało się załadować listy zamówień
              </h2>
              <p className={styles.stateDescription}>
                Spróbuj odświeżyć stronę. Jeśli problem będzie się powtarzał,
                zaloguj się ponownie.
              </p>
              <div className={styles.stateActions}>
                <Button
                  href="/konto-klienta/"
                  variant="secondary"
                  iconUsed="arrowLeft"
                  className={styles.actionButton}
                >
                  Wróć do logowania
                </Button>
              </div>
            </section>
          ) : pageData.orders.length === 0 ? (
            <section className={styles.stateCard}>
              <h2 className={styles.stateHeading}>
                Brak zamówień do wyświetlenia
              </h2>
              <p className={styles.stateDescription}>
                Po zalogowaniu pokazujemy tylko zamówienia aktywne lub widoczne
                dla klienta. Szczegóły zamówień dodamy w kolejnych krokach tej
                fazy.
              </p>
              <div className={styles.stateActions}>
                <Button
                  href="/produkty/"
                  variant="primary"
                  iconUsed="arrowRight"
                  className={styles.actionButton}
                >
                  Przejdź do sklepu
                </Button>
              </div>
            </section>
          ) : (
            <ul className={styles.orderList}>
              {pageData.orders.map((order) => (
                <li key={order.id} className={styles.orderCard}>
                  <div className={styles.orderHeader}>
                    <div className={styles.orderIdentity}>
                      <span className={styles.orderEyebrow}>
                        Numer zamówienia
                      </span>
                      <span className={styles.orderNumber}>
                        {order.orderNumber}
                      </span>
                    </div>
                    <span
                      className={styles.orderStatus}
                      data-tone={getOrderStatusTone(order)}
                    >
                      {getOrderStatusLabel(order)}
                    </span>
                  </div>

                  <dl className={styles.orderMetaGrid}>
                    <div className={styles.orderMetaItem}>
                      <dt className={styles.metaLabel}>Data utworzenia</dt>
                      <dd className={styles.metaValue}>
                        {formatOrderDate(order.createdAt)}
                      </dd>
                    </div>
                    <div className={styles.orderMetaItem}>
                      <dt className={styles.metaLabel}>Wartość zamówienia</dt>
                      <dd className={styles.metaValue}>
                        {formatPrice(order.grandTotalCents)}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
