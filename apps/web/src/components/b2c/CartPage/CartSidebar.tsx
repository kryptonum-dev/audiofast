import SupportCard, {
  type SupportCardData,
} from '@/src/components/b2c/shared/SupportCard';
import type { CartCouponRevalidationNotice } from '@/src/global/b2c/cart/cart-context';
import type { CartState, CartTotals } from '@/src/global/b2c/cart/types';

import CartCouponCard from './CartCouponCard';
import CartSummaryCard from './CartSummaryCard';
import styles from './styles.module.scss';

type CartSidebarProps = {
  cart: CartState;
  totals: CartTotals;
  supportCard?: SupportCardData | null;
  onCheckout: () => void;
  onApplyCoupon: (code: string) => Promise<void>;
  onClearCoupon: () => void;
  isCartRuntimeLoading?: boolean;
  isApplyingCoupon?: boolean;
  isRevalidatingCoupon?: boolean;
  couponRequestError?: string | null;
  couponRevalidationNotice?: CartCouponRevalidationNotice | null;
  canRetryCouponRevalidation?: boolean;
  onRetryCouponRevalidation?: () => Promise<void>;
  onCouponInputChange?: () => void;
};

export default function CartSidebar({
  cart,
  totals,
  supportCard,
  onCheckout,
  onApplyCoupon,
  onClearCoupon,
  isCartRuntimeLoading = false,
  isApplyingCoupon = false,
  isRevalidatingCoupon = false,
  couponRequestError = null,
  couponRevalidationNotice = null,
  canRetryCouponRevalidation = false,
  onRetryCouponRevalidation,
  onCouponInputChange,
}: CartSidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Podsumowanie koszyka">
      <CartSummaryCard
        cart={cart}
        totals={totals}
        onCheckout={onCheckout}
        isCartRuntimeLoading={isCartRuntimeLoading}
      />
      <CartCouponCard
        cart={cart}
        onApplyCoupon={onApplyCoupon}
        onClearCoupon={onClearCoupon}
        isCartRuntimeLoading={isCartRuntimeLoading}
        isApplyingCoupon={isApplyingCoupon}
        isRevalidatingCoupon={isRevalidatingCoupon}
        inputError={couponRequestError}
        statusNotice={couponRevalidationNotice}
        canRetryStatus={canRetryCouponRevalidation}
        onRetryStatus={onRetryCouponRevalidation}
        onInputChange={onCouponInputChange}
      />
      <div className={styles.sidebarSupport}>
        <SupportCard supportCard={supportCard} />
      </div>
    </aside>
  );
}
