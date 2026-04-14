'use client';

import { useCallback } from 'react';

import { getCartLineDiscountCents } from '@/src/global/b2c/cart/cart-selectors';
import { useCart } from '@/src/global/b2c/cart/use-cart';

import CartEmptyState from './CartEmptyState';
import CartItemCard from './CartItemCard';
import CartLoadingSkeleton from './CartLoadingSkeleton';
import CartSidebar from './CartSidebar';
import styles from './styles.module.scss';
import type { CartEmptyStateData, CartSupportCardData } from './types';

type CartPageClientProps = {
  supportCard?: CartSupportCardData | null;
  emptyStateContent?: CartEmptyStateData | null;
  previewState?: 'loading' | 'empty' | 'content';
};

export default function CartPageClient({
  supportCard = null,
  emptyStateContent = null,
  previewState,
}: CartPageClientProps) {
  const {
    cart,
    isHydrated,
    totals,
    isApplyingCoupon,
    isRevalidatingCoupon,
    couponRequestError,
    couponRevalidationNotice,
    canRetryCouponRevalidation,
    removeLine,
    setStandardLineQuantity,
    incrementStandardLineQuantity,
    decrementStandardLineQuantity,
    applyCoupon,
    clearCouponRequestError,
    retryCouponRevalidation,
    clearCoupon,
  } = useCart();

  const handleCheckout = useCallback(() => {}, []);
  const handleApplyCoupon = useCallback(
    async (code: string) => {
      await applyCoupon(code);
    },
    [applyCoupon],
  );
  const handleClearCoupon = useCallback(() => {
    clearCoupon();
  }, [clearCoupon]);

  const shouldShowLoadingState = previewState === 'loading' || !isHydrated;
  const shouldShowEmptyState =
    previewState === 'empty' ||
    (previewState !== 'content' && cart.lines.length === 0);

  if (shouldShowLoadingState) {
    return (
      <main id="main" className={`${styles.cartPage} max-width`}>
        <CartLoadingSkeleton />
      </main>
    );
  }

  return (
    <main id="main" className={`${styles.cartPage} max-width`}>
      {shouldShowEmptyState ? (
        <CartEmptyState
          supportCard={supportCard}
          emptyStateContent={emptyStateContent}
        />
      ) : (
        <section className={styles.content}>
          <div className={styles.itemsColumn}>
            {cart.lines.map((line) => (
              <CartItemCard
                key={line.lineId}
                line={line}
                lineDiscountCents={getCartLineDiscountCents(cart, line.lineId)}
                onRemove={removeLine}
                onSetQuantity={
                  line.lineType === 'standard'
                    ? setStandardLineQuantity
                    : undefined
                }
                onIncrementQuantity={
                  line.lineType === 'standard'
                    ? incrementStandardLineQuantity
                    : undefined
                }
                onDecrementQuantity={
                  line.lineType === 'standard'
                    ? decrementStandardLineQuantity
                    : undefined
                }
              />
            ))}
          </div>

          <CartSidebar
            cart={cart}
            totals={totals}
            supportCard={supportCard}
            onCheckout={handleCheckout}
            onApplyCoupon={handleApplyCoupon}
            onClearCoupon={handleClearCoupon}
            isApplyingCoupon={isApplyingCoupon}
            isRevalidatingCoupon={isRevalidatingCoupon}
            couponRequestError={couponRequestError}
            couponRevalidationNotice={couponRevalidationNotice}
            canRetryCouponRevalidation={canRetryCouponRevalidation}
            onRetryCouponRevalidation={retryCouponRevalidation}
            onCouponInputChange={clearCouponRequestError}
          />
        </section>
      )}
    </main>
  );
}
