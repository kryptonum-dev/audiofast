import Link from 'next/link';

import Button from '@/src/components/ui/Button';
import {
  getCheckoutCartTotals,
  isCartCheckoutBlocked,
} from '@/src/global/b2c/cart/cart-selectors';
import type { CartState } from '@/src/global/b2c/cart/types';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

type CheckoutSummaryCardProps = {
  cart: CartState;
  formId: string;
  isSubmitting?: boolean;
};

function renderPrice(priceCents: number) {
  return formatPrice(priceCents).replace(/\s+/g, ' ').trim();
}

export default function CheckoutSummaryCard({
  cart,
  formId,
  isSubmitting = false,
}: CheckoutSummaryCardProps) {
  const totals = getCheckoutCartTotals(cart);
  const checkoutBlocked = isCartCheckoutBlocked(cart);
  const couponCode = cart.coupon?.isValid ? cart.coupon.code : null;
  const checkoutDisabled =
    isSubmitting || checkoutBlocked || totals.lineCount === 0;

  return (
    <section className={styles.sidebarCard}>
      <h2 className={styles.sidebarHeading}>Podsumowanie</h2>
      <div className={styles.summaryRows}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>
            Produkty ({totals.itemCount} szt.)
          </span>
          <span className={styles.summaryValue}>
            {renderPrice(totals.subtotalCents)}
          </span>
        </div>

        {totals.discountTotalCents > 0 ? (
          <div className={`${styles.summaryRow} ${styles.summaryRowDiscount}`}>
            <span className={styles.summaryLabel}>
              {couponCode ? `Kod rabatowy (${couponCode})` : 'Rabat'}
            </span>
            <span className={styles.summaryValue}>
              -{renderPrice(totals.discountTotalCents)}
            </span>
          </div>
        ) : null}

        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Dostawa</span>
          <span className={styles.summaryValue}>0 zł</span>
        </div>

        <div className={`${styles.summaryRow} ${styles.summaryRowTotal}`}>
          <span className={styles.summaryLabel}>Do zapłaty</span>
          <span className={styles.summaryValue}>
            {renderPrice(totals.grandTotalCents)}
          </span>
        </div>
      </div>

      {checkoutBlocked ? (
        <div className={styles.blockingMessage} role="alert">
          <div className={styles.blockingMessageIcon} aria-hidden="true">
            <AlertIcon />
          </div>
          <p className={styles.blockingMessageText}>
            Koszyk wymaga poprawek przed przejściem do płatności. Wróć do
            koszyka i zaktualizuj pozycje.
          </p>
        </div>
      ) : null}

      <Button
        type="submit"
        form={formId}
        text="Przejdź do płatności"
        iconUsed="arrowRight"
        isLoading={isSubmitting}
        disabled={checkoutDisabled}
        className={styles.sidebarButton}
      />

      <Link href="/koszyk/" className={`link ${styles.summaryBackLink}`}>
        Wróć do koszyka
      </Link>
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
      clipPath="url(#checkout-summary-alert-clip)"
    >
      <path d="M9.996 20.777a8.94 8.94 0 0 1-2.48-.97M14 3.223a9.003 9.003 0 0 1 0 17.554M4.579 17.093a8.963 8.963 0 0 1-1.227-2.592M3.125 10.5c.16-.95.468-1.85.9-2.675l.169-.305M6.906 4.579A8.954 8.954 0 0 1 10 3.223M12 8v4M12 16v.01" />
    </g>
    <defs>
      <clipPath id="checkout-summary-alert-clip">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
