import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { ComponentProps } from 'react';

import CheckoutSteps from '@/src/components/b2c/CheckoutSteps';
import Button from '@/src/components/ui/Button';
import { loadThankYouPageData } from '@/src/global/b2c/checkout/server/load-thank-you-page';
import {
  type CheckoutThankYouStateId,
  shouldRenderCheckoutConfirmationPage,
} from '@/src/global/b2c/checkout/server/thank-you-state';

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
    refresh?: string;
  }>;
};

function buildRefreshHref(args: {
  orderNumber: string | null;
  refreshRequested?: boolean;
}): string {
  if (args.orderNumber === null) {
    return '/podziekowania-za-zakup/';
  }

  const url = new URL('/podziekowania-za-zakup/', 'http://localhost');
  url.searchParams.set('order', args.orderNumber);

  if (args.refreshRequested) {
    url.searchParams.set('refresh', '1');
  }

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function SuccessCheckoutIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        clipPath="url(#thank-you-success-icon)"
      >
        <path d="M9.996 20.777a9 9 0 0 1-2.48-.97M14 3.223a9.003 9.003 0 0 1 0 17.554M4.579 17.093a9 9 0 0 1-1.227-2.592M3.125 10.5c.16-.95.468-1.85.9-2.675l.169-.305M6.906 4.579A9 9 0 0 1 10 3.223" />
        <path d="m9 12 2 2 4-4" />
      </g>
      <defs>
        <clipPath id="thank-you-success-icon">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function renderBadgeIcon(
  stateId: 'awaiting_payment' | 'paid' | 'expired' | 'invalid_access',
) {
  if (stateId === 'paid') {
    return <SuccessCheckoutIcon />;
  }

  if (stateId === 'awaiting_payment') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <g
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          clipPath="url(#awaiting-payment-icon)"
        >
          <path d="M21 12a9 9 0 1 0-9 9" />
          <path d="M12 7v5l2 2M18.42 15.61a2.101 2.101 0 0 1 2.97 2.97L18 22h-3v-3z" />
        </g>
        <defs>
          <clipPath id="awaiting-payment-icon">
            <path fill="#fff" d="M0 0h24v24H0z" />
          </clipPath>
        </defs>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="24"
      height="24"
    >
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}

function getThankYouActions(args: {
  stateId: CheckoutThankYouStateId;
  refreshHref: string;
  shouldPoll: boolean;
  orderNumber: string | null;
}) {
  if (args.stateId === 'paid') {
    return {
      primaryHref: '/konto-klienta/',
      primaryLabel: 'Przejdź do konta klienta',
      secondaryHref: '/produkty/',
      secondaryLabel: 'Wróć do produktów',
    };
  }

  const secondaryHref =
    args.shouldPoll && args.orderNumber
      ? args.refreshHref
      : '/koszyk/twoje-dane/';
  const secondaryLabel =
    args.shouldPoll && args.orderNumber
      ? 'Odśwież status płatności'
      : 'Przejdź ponownie do checkoutu';

  return {
    primaryHref: '/produkty/',
    primaryLabel: 'Wróć do sklepu',
    secondaryHref,
    secondaryLabel,
  };
}

export default async function ThankYouPage({
  searchParams,
}: ThankYouPageProps) {
  noStore();
  await connection();

  const resolvedSearchParams = await searchParams;
  const thankYouPageData = await loadThankYouPageData(resolvedSearchParams);

  if (!shouldRenderCheckoutConfirmationPage(thankYouPageData.state.id)) {
    notFound();
  }

  const refreshHref = buildRefreshHref({
    orderNumber: thankYouPageData.orderNumber,
    refreshRequested: true,
  });
  const actions = getThankYouActions({
    stateId: thankYouPageData.state.id,
    refreshHref,
    shouldPoll: thankYouPageData.state.shouldPoll,
    orderNumber: thankYouPageData.orderNumber,
  });
  const isGuestPaidSuccessState = thankYouPageData.state.id === 'paid';
  const thankYouRenderKey = [
    thankYouPageData.state.id,
    thankYouPageData.orderNumber ?? 'no-order',
    resolvedSearchParams.refresh ?? 'no-refresh',
  ].join(':');

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
          <div key={thankYouRenderKey} className={styles.card}>
            <span className={styles.badge} aria-hidden="true">
              {renderBadgeIcon(thankYouPageData.state.id)}
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
            {thankYouPageData.state.description ? (
              <p className={styles.description}>
                {thankYouPageData.state.description}
              </p>
            ) : null}
            {isGuestPaidSuccessState ? (
              <div className={styles.accountPrompt}>
                <p className={styles.accountPromptTitle}>
                  Zachowaj wygodny dostęp do zamówienia
                </p>
                <p className={styles.accountPromptDescription}>
                  Użyj tego samego adresu e-mail, aby sprawdzić status
                  zamówienia w koncie klienta.
                </p>
              </div>
            ) : null}
            <div className={styles.actions}>
              <Button
                href={actions.primaryHref}
                text={actions.primaryLabel}
                iconUsed="arrowUp"
                className={styles.actionButton}
              />
              <Button
                href={actions.secondaryHref}
                text={actions.secondaryLabel}
                variant="secondary"
                iconUsed="arrowUp"
                className={styles.actionButton}
              />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
