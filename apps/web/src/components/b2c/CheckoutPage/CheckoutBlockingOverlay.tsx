'use client';

import { useEffect } from 'react';

import Button from '@/src/components/ui/Button';
import type { CartLine } from '@/src/global/b2c/cart/types';

import styles from './styles.module.scss';

type CheckoutBlockingOverlayProps = {
  blockingLines: CartLine[];
  onClose: () => void;
};

export default function CheckoutBlockingOverlay({
  blockingLines,
  onClose,
}: CheckoutBlockingOverlayProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      className={styles.blockingOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-blocking-heading"
      aria-describedby="checkout-blocking-description"
    >
      <div
        className={styles.blockingOverlayCard}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.blockingOverlayIconWrapper} aria-hidden="true">
          <AlertIcon />
        </div>
        <h2
          id="checkout-blocking-heading"
          className={styles.blockingOverlayHeading}
        >
          Koszyk wymaga aktualizacji
        </h2>
        <p
          id="checkout-blocking-description"
          className={styles.blockingOverlayDescription}
        >
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

        <div className={styles.blockingOverlayActions}>
          <Button
            type="button"
            variant="secondary"
            text="Zamknij"
            onClick={onClose}
            className={styles.blockingOverlayCancelButton}
          />
          <Button
            href="/koszyk/"
            text="Przejdź do koszyka"
            iconUsed="arrowLeft"
            className={styles.blockingOverlayConfirmButton}
          />
        </div>
      </div>
    </div>
  );
}

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#checkout-blocking-alert-icon)"
    >
      <path d="M9.996 20.777a8.94 8.94 0 0 1-2.48-.97M14 3.223a9.003 9.003 0 0 1 0 17.554M4.579 17.093a8.963 8.963 0 0 1-1.227-2.592M3.125 10.5c.16-.95.468-1.85.9-2.675l.169-.305M6.906 4.579A8.954 8.954 0 0 1 10 3.223M12 8v4M12 16v.01" />
    </g>
    <defs>
      <clipPath id="checkout-blocking-alert-icon">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
