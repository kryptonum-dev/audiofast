import type { CartState, CartTotals } from '@/src/global/b2c/cart/types';

import CartCouponCard from './CartCouponCard';
import CartSummaryCard from './CartSummaryCard';
import CartSupportCard from './CartSupportCard';
import styles from './styles.module.scss';
import type { CartSupportCardData } from './types';

export type CartSidebarProps = {
  cart: CartState;
  totals: CartTotals;
  supportCard?: CartSupportCardData | null;
  onCheckout: () => void;
  onApplyCoupon: (code: string) => void;
  onClearCoupon: () => void;
};

export default function CartSidebar({
  cart,
  totals,
  supportCard,
  onCheckout,
  onApplyCoupon,
  onClearCoupon,
}: CartSidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Podsumowanie koszyka">
      <CartSummaryCard cart={cart} totals={totals} onCheckout={onCheckout} />
      <CartCouponCard
        cart={cart}
        onApplyCoupon={onApplyCoupon}
        onClearCoupon={onClearCoupon}
      />
      <CartSupportCard supportCard={supportCard} />
    </aside>
  );
}
