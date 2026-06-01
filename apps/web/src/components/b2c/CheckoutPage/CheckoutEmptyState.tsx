import Button from '@/src/components/ui/Button';

import styles from './CheckoutEmptyState.module.scss';

export default function CheckoutEmptyState() {
  return (
    <main id="main">
      <section
        className={`${styles.checkoutEmptyState} max-width`}
        aria-live="polite"
      >
        <div className={styles.emptyPanel}>
          <div className={styles.emptyPanelInner}>
            <div className={styles.emptyIcon} aria-hidden="true">
              <AlertIcon />
            </div>

            <h1 className={styles.emptyTitle}>Twój koszyk jest pusty</h1>

            <p className={styles.emptyDescription}>
              Dodaj produkty do koszyka, aby przejść do formularza zamówienia.
            </p>

            <Button
              href="/koszyk/"
              text="Wróć do koszyka"
              iconUsed="arrowLeft"
              className={styles.emptyButton}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#checkout-empty-state-icon)"
    >
      <path d="M9.996 20.777a8.94 8.94 0 0 1-2.48-.97M14 3.223a9.003 9.003 0 0 1 0 17.554M4.579 17.093a8.963 8.963 0 0 1-1.227-2.592M3.125 10.5c.16-.95.468-1.85.9-2.675l.169-.305M6.906 4.579A8.954 8.954 0 0 1 10 3.223M12 8v4M12 16v.01" />
    </g>
    <defs>
      <clipPath id="checkout-empty-state-icon">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
