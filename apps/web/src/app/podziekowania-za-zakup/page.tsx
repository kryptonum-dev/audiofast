import type { Metadata } from 'next';
import Link from 'next/link';

import CheckoutSteps from '@/src/components/b2c/CheckoutSteps';

import styles from './styles.module.scss';

export const metadata: Metadata = {
  title: 'Dziękujemy za zakup | Audiofast',
  description:
    'Potwierdzenie zamówienia w Audiofast. Integracja płatności zostanie podłączona w kolejnym kroku.',
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
  searchParams: Promise<{ order?: string }>;
};

export default async function ThankYouPage({
  searchParams,
}: ThankYouPageProps) {
  const { order } = await searchParams;
  const orderNumber =
    typeof order === 'string' && order.trim().length > 0 ? order.trim() : null;

  return (
    <>
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
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <h1 id="thank-you-heading" className={styles.heading}>
              Dziękujemy za zamówienie
            </h1>
            {orderNumber ? (
              <p className={styles.orderNumber}>
                Numer zamówienia:{' '}
                <strong className={styles.orderNumberValue}>
                  {orderNumber}
                </strong>
              </p>
            ) : null}
            <p className={styles.description}>
              To jest tymczasowa strona potwierdzenia. Integrację płatności i
              finalne powiadomienia podłączymy w kolejnym kroku implementacji.
              Na razie zamówienie zostało zarejestrowane w bazie.
            </p>
            <div className={styles.actions}>
              <Link href="/produkty/" className={styles.primaryCta}>
                Wróć do sklepu
              </Link>
              <Link href="/koszyk/twoje-dane/" className={styles.secondaryCta}>
                Przejdź ponownie do checkoutu
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
