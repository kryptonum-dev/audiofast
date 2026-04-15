'use client';

import Button from '@/src/components/ui/Button';
import { formatPrice } from '@/src/global/utils';

import CartSupportCard from './CartSupportCard';
import styles from './styles.module.scss';
import type { CartEmptyStateData, CartSupportCardData } from './types';

type CartEmptyStateProps = {
  supportCard?: CartSupportCardData | null;
  emptyStateContent?: CartEmptyStateData | null;
};

const FALLBACK_EMPTY_STATE = {
  heading: 'Koszyk jest pusty',
  description:
    'Dodaj produkt standardowy lub egzemplarz CPO, aby rozpocząć zakupy. Po dodaniu produktów zobaczysz podsumowanie zamówienia.',
  buttonText: 'Kontynuuj zakupy',
};

export default function CartEmptyState({
  supportCard = null,
  emptyStateContent = null,
}: CartEmptyStateProps) {
  const zeroPrice = formatPrice(0).replace(/\s+/g, ' ').trim();
  const heading =
    emptyStateContent?.heading?.trim() || FALLBACK_EMPTY_STATE.heading;
  const description =
    emptyStateContent?.description?.trim() || FALLBACK_EMPTY_STATE.description;
  const buttonText =
    emptyStateContent?.buttonText?.trim() || FALLBACK_EMPTY_STATE.buttonText;

  return (
    <section className={styles.emptyStateLayout} aria-live="polite">
      <div className={styles.emptyPanel}>
        <div className={styles.emptyPanelInner}>
          <div className={styles.emptyIcon} aria-hidden="true">
            <AlertIcon />
          </div>

          <h2 className={styles.emptyTitle}>{heading}</h2>

          <p className={styles.emptyDescription}>{description}</p>

          <Button
            href="/produkty"
            text={buttonText}
            iconUsed="arrowLeft"
            className={styles.emptyButton}
          />
        </div>
      </div>

      <aside
        className={styles.sidebar}
        aria-label="Podsumowanie pustego koszyka"
      >
        <section className={styles.sidebarCard}>
          <h2 className={styles.sidebarHeading}>Podsumowanie</h2>

          <div className={styles.summaryRows} data-empty="true">
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Produkty (0 szt.)</span>
              <span className={styles.summaryValue}>{zeroPrice}</span>
            </div>

            <div className={`${styles.summaryRow} ${styles.summaryRowTotal}`}>
              <span className={styles.summaryLabel}>Do zapłaty</span>
              <span className={styles.summaryValue}>{zeroPrice}</span>
            </div>
          </div>

          <p className={styles.sidebarHint}>
            Podsumowanie aktywuje się po dodaniu pierwszego produktu do koszyka.
          </p>

          <Button
            type="button"
            text="Dalej"
            iconUsed="arrowRight"
            disabled
            className={styles.sidebarButton}
          />
        </section>

        <section className={styles.sidebarCard}>
          <h2 className={styles.sidebarHeading}>Kod rabatowy</h2>

          <div className={styles.couponForm} data-empty="true">
            <div className={styles.couponField}>
              <input
                type="text"
                defaultValue=""
                placeholder="Wpisz kod"
                disabled
                aria-label="Kod rabatowy"
              />
            </div>

            <Button
              type="button"
              text="Zastosuj"
              variant="secondary"
              focusOutline="black"
              iconUsed="submit"
              disabled
              className={styles.couponButton}
            />
          </div>

          <p className={styles.sidebarHint}>
            Kod rabatowy będzie dostępny po dodaniu produktu do koszyka.
          </p>
        </section>

        {supportCard ? (
          <CartSupportCard supportCard={supportCard} />
        ) : (
          <section className={styles.sidebarCard} aria-label="Wsparcie">
            <p className={styles.supportFallback}>
              Masz pytania o produkty albo zamówienie? Skontaktuj się z nami, a
              pomożemy dobrać najlepsze rozwiązanie.
            </p>
          </section>
        )}
      </aside>
    </section>
  );
}

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#cart-empty-state-icon)"
    >
      <path d="M9.996 20.777a8.94 8.94 0 0 1-2.48-.97M14 3.223a9.003 9.003 0 0 1 0 17.554M4.579 17.093a8.963 8.963 0 0 1-1.227-2.592M3.125 10.5c.16-.95.468-1.85.9-2.675l.169-.305M6.906 4.579A8.954 8.954 0 0 1 10 3.223M12 8v4M12 16v.01" />
    </g>
    <defs>
      <clipPath id="cart-empty-state-icon">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
