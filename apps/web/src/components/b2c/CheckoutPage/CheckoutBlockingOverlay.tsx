import Link from 'next/link';

import type { CartLine } from '@/src/global/b2c/cart/types';

import styles from './styles.module.scss';

type CheckoutBlockingOverlayProps = {
  blockingLines: CartLine[];
};

export default function CheckoutBlockingOverlay({
  blockingLines,
}: CheckoutBlockingOverlayProps) {
  return (
    <div
      className={styles.blockingOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-blocking-heading"
    >
      <div className={styles.blockingOverlayCard}>
        <h2
          id="checkout-blocking-heading"
          className={styles.blockingOverlayHeading}
        >
          Koszyk wymaga aktualizacji
        </h2>
        <p className={styles.blockingOverlayDescription}>
          Niektóre produkty w Twoim koszyku nie są już dostępne do zakupu. Wróć
          do koszyka, aby zaktualizować zamówienie.
        </p>

        {blockingLines.length > 0 ? (
          <ul className={styles.blockingOverlayList}>
            {blockingLines.map((line) => {
              const blockingIssues = line.issues.filter(
                (issue) => issue.blocking,
              );

              return (
                <li
                  key={line.lineId}
                  className={styles.blockingOverlayListItem}
                >
                  <span className={styles.blockingOverlayProductName}>
                    {line.productName}
                  </span>
                  {blockingIssues.length > 0 ? (
                    <span className={styles.blockingOverlayIssue}>
                      {blockingIssues[0]?.message}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        <Link href="/koszyk/" className={styles.blockingOverlayCta}>
          Wróć do koszyka
        </Link>
      </div>
    </div>
  );
}
