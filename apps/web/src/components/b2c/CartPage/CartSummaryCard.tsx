import Button from '@/src/components/ui/Button';
import { isCartCheckoutBlocked } from '@/src/global/b2c/cart/cart-selectors';
import type { CartState, CartTotals } from '@/src/global/b2c/cart/types';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

type CartSummaryCardProps = {
  cart: CartState;
  totals: CartTotals;
  onCheckout: () => void;
};

export default function CartSummaryCard({
  cart,
  totals,
  onCheckout,
}: CartSummaryCardProps) {
  const checkoutBlocked = isCartCheckoutBlocked(cart);
  const renderPrice = (priceCents: number) =>
    formatPrice(priceCents).replace(/\s+/g, ' ').trim();

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
            <span className={styles.summaryLabel}>Rabat</span>
            <span className={styles.summaryValue}>
              -{renderPrice(totals.discountTotalCents)}
            </span>
          </div>
        ) : null}

        <div className={`${styles.summaryRow} ${styles.summaryRowTotal}`}>
          <span className={styles.summaryLabel}>Do zapłaty</span>
          <span className={styles.summaryValue}>
            {renderPrice(totals.grandTotalCents)}
          </span>
        </div>
      </div>

      {checkoutBlocked ? (
        <p className={styles.blockingMessage}>
          Koszyk zawiera pozycje wymagające poprawy przed przejściem dalej.
        </p>
      ) : null}

      <Button
        type="button"
        text="Do kasy"
        iconUsed="arrowRight"
        onClick={onCheckout}
        disabled={checkoutBlocked}
        className={styles.sidebarButton}
      />
    </section>
  );
}
