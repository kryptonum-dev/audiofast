'use client';

import { useCallback, useMemo, useState } from 'react';

import SupportCard, {
  type SupportCardData,
} from '@/src/components/b2c/shared/SupportCard';
import { getInvalidCartLines } from '@/src/global/b2c/cart/cart-selectors';
import type { CartState } from '@/src/global/b2c/cart/types';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import type {
  CheckoutDraft,
  CheckoutSessionContext,
} from '@/src/global/b2c/checkout/types';

import CheckoutBlockingOverlay from './CheckoutBlockingOverlay';
import CheckoutEmptyState from './CheckoutEmptyState';
import CheckoutForm from './CheckoutForm';
import CheckoutLoadingSkeleton from './CheckoutLoadingSkeleton';
import CheckoutOrderPreview from './CheckoutOrderPreview';
import CheckoutSummaryCard from './CheckoutSummaryCard';
import { CHECKOUT_FORM_ID } from './constants';
import styles from './styles.module.scss';

type CheckoutPageClientProps = {
  initialDraft: CheckoutDraft;
  isEmailLocked: boolean;
  sessionContext: CheckoutSessionContext;
  supportCard?: SupportCardData | null;
};

export default function CheckoutPageClient({
  initialDraft,
  isEmailLocked,
  sessionContext,
  supportCard = null,
}: CheckoutPageClientProps) {
  const { cart, isHydrated, applyCartLineRevalidation, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCartBlockingOverlayOpen, setIsCartBlockingOverlayOpen] =
    useState(false);
  const [showPriceChangeNotice, setShowPriceChangeNotice] = useState(false);
  const cartState = cart as CartState;
  const blockingCartLines = useMemo(
    () => getInvalidCartLines(cartState),
    [cartState],
  );
  const openCartBlockingOverlay = useCallback(() => {
    setIsCartBlockingOverlayOpen(true);
  }, []);
  const closeCartBlockingOverlay = useCallback(() => {
    setIsCartBlockingOverlayOpen(false);
  }, []);

  if (!isHydrated) {
    return <CheckoutLoadingSkeleton />;
  }

  if (cart.lines.length === 0) {
    return <CheckoutEmptyState />;
  }

  return (
    <main id="main">
      <section className={`${styles.checkoutPage} max-width`}>
        <div className={styles.layout}>
          <div className={styles.formColumn}>
            {showPriceChangeNotice ? (
              <div
                className={styles.priceChangeNotice}
                role="status"
                aria-live="polite"
              >
                <strong className={styles.priceChangeNoticeTitle}>
                  Ceny zostały zaktualizowane
                </strong>
                <p className={styles.priceChangeNoticeText}>
                  Sprawdź nową łączną kwotę i ponownie kliknij „Przejdź do
                  płatności”, aby potwierdzić zamówienie.
                </p>
              </div>
            ) : null}

            <CheckoutOrderPreview cart={cartState} />

            <CheckoutForm
              initialDraft={initialDraft}
              isEmailLocked={isEmailLocked}
              sessionContext={sessionContext}
              cart={cartState}
              applyCartLineRevalidation={applyCartLineRevalidation}
              onCartEmpty={clearCart}
              onPriceChangeNoticeChange={setShowPriceChangeNotice}
              onCartBlockingOverlayOpen={openCartBlockingOverlay}
              onSubmittingChange={setIsSubmitting}
            />
          </div>

          <aside className={styles.sidebar}>
            <CheckoutSummaryCard
              cart={cartState}
              formId={CHECKOUT_FORM_ID}
              isSubmitting={isSubmitting}
            />
            <SupportCard supportCard={supportCard} />
          </aside>
        </div>

        {isCartBlockingOverlayOpen ? (
          <CheckoutBlockingOverlay
            blockingLines={blockingCartLines}
            onClose={closeCartBlockingOverlay}
          />
        ) : null}
      </section>
    </main>
  );
}
