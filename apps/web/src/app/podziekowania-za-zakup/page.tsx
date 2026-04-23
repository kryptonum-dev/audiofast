import type { Metadata } from 'next';
import Link from 'next/link';

import CheckoutSteps from '@/src/components/b2c/CheckoutSteps';
import { loadThankYouPageData } from '@/src/global/b2c/checkout/server/load-thank-you-page';

import styles from './styles.module.scss';
import ThankYouCartCleanup from './ThankYouCartCleanup';

export const metadata: Metadata = {
  title: 'Dziękujemy za zakup | Audiofast',
  description: 'Status płatności i zamówienia w Audiofast.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

type ThankYouPageProps = {
  searchParams: Promise<{
    order?: string;
    status?: string;
    scenario?: string;
    refresh?: string;
  }>;
};

function buildRefreshHref(args: {
  orderNumber: string | null;
  returnStatus: string | null;
  mockScenarioId: string | null;
  refreshRequested?: boolean;
}): string {
  if (args.orderNumber === null) {
    return '/podziekowania-za-zakup/';
  }

  const url = new URL('/podziekowania-za-zakup/', 'http://localhost');
  url.searchParams.set('order', args.orderNumber);

  if (args.returnStatus) {
    url.searchParams.set('status', args.returnStatus);
  }

  if (args.mockScenarioId) {
    url.searchParams.set('scenario', args.mockScenarioId);
  }

  if (args.refreshRequested) {
    url.searchParams.set('refresh', '1');
  }

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function renderBadgeIcon(
  stateId: 'awaiting_payment' | 'paid' | 'expired' | 'invalid_access',
) {
  if (stateId === 'paid') {
    return <path d="M20 6 9 17l-5-5" />;
  }

  if (stateId === 'awaiting_payment') {
    return (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </>
    );
  }

  return (
    <>
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </>
  );
}

export default async function ThankYouPage({
  searchParams,
}: ThankYouPageProps) {
  const resolvedSearchParams = await searchParams;
  const thankYouPageData = await loadThankYouPageData(resolvedSearchParams);
  const refreshHref = buildRefreshHref({
    orderNumber: thankYouPageData.orderNumber,
    returnStatus: thankYouPageData.returnStatus,
    mockScenarioId: thankYouPageData.mockScenarioId,
    refreshRequested: true,
  });
  const secondaryHref =
    thankYouPageData.state.shouldPoll && thankYouPageData.orderNumber
      ? refreshHref
      : '/koszyk/twoje-dane/';
  const secondaryLabel =
    thankYouPageData.state.shouldPoll && thankYouPageData.orderNumber
      ? 'Odśwież status płatności'
      : 'Przejdź ponownie do checkoutu';

  return (
    <>
      <ThankYouCartCleanup
        stateId={thankYouPageData.state.id}
        orderNumber={thankYouPageData.orderNumber}
      />
      <CheckoutSteps currentStep="confirmation" />
      <main id="main" className="max-width">
        <section
          className={styles.thankYouPage}
          aria-labelledby="thank-you-heading"
        >
          <div className={styles.card}>
            <span className={styles.badge} aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="32"
                height="32"
              >
                {renderBadgeIcon(thankYouPageData.state.id)}
              </svg>
            </span>
            <h1 id="thank-you-heading" className={styles.heading}>
              {thankYouPageData.state.title}
            </h1>
            {thankYouPageData.orderNumber ? (
              <p className={styles.orderNumber}>
                Numer zamówienia:{' '}
                <strong className={styles.orderNumberValue}>
                  {thankYouPageData.orderNumber}
                </strong>
              </p>
            ) : null}
            <p className={styles.description}>
              {thankYouPageData.state.description}
            </p>
            {thankYouPageData.state.showSupportContact ? (
              <p className={styles.supportNote}>
                Jeśli potrzebujesz pomocy, przygotuj numer zamówienia i
                skontaktuj się z obsługą Audiofast.
              </p>
            ) : null}
            <div className={styles.actions}>
              <Link href="/produkty/" className={styles.primaryCta}>
                Wróć do sklepu
              </Link>
              <Link href={secondaryHref} className={styles.secondaryCta}>
                {secondaryLabel}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
