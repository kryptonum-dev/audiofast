'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchCartLinePricing } from '@/src/app/actions/cart-pricing';
import CartLineConfigurationModal from '@/src/components/b2c/CartLineConfigurationModal';
import type { CartLinePricingCacheEntry } from '@/src/components/b2c/CartLineConfigurationModal/pricing-cache';
import { getCartLineDiscountCents } from '@/src/global/b2c/cart/cart-selectors';
import type { StandardCartLine } from '@/src/global/b2c/cart/types';
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

const IDLE_PRICING_STATE: CartLinePricingCacheEntry = {
  status: 'idle',
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
    replaceStandardLine,
    applyCoupon,
    clearCouponRequestError,
    retryCouponRevalidation,
    clearCoupon,
  } = useCart();
  const [activeConfigurationLineId, setActiveConfigurationLineId] = useState<
    string | null
  >(null);
  const [pricingByProductKey, setPricingByProductKey] = useState<
    Record<string, CartLinePricingCacheEntry>
  >({});
  const pricingByProductKeyRef = useRef(pricingByProductKey);
  const pricingRequestsInFlightRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    pricingByProductKeyRef.current = pricingByProductKey;
  }, [pricingByProductKey]);

  const standardLines = useMemo(
    () =>
      cart.lines.filter(
        (cartLine): cartLine is StandardCartLine =>
          cartLine.lineType === 'standard',
      ),
    [cart.lines],
  );

  const configurableProductKeys = useMemo(
    () =>
      Array.from(
        new Set(
          standardLines
            .filter((line) => line.configurationSummary.length > 0)
            .map((line) => line.productKey),
        ),
      ),
    [standardLines],
  );

  const loadPricingForProductKey = useCallback(
    async (productKey: string, options?: { force?: boolean }) => {
      const currentEntry = pricingByProductKeyRef.current[productKey];
      const shouldForce = options?.force ?? false;

      if (pricingRequestsInFlightRef.current.has(productKey)) {
        return;
      }

      if (
        !shouldForce &&
        currentEntry &&
        currentEntry.status !== 'idle' &&
        currentEntry.status !== 'error'
      ) {
        return;
      }

      pricingRequestsInFlightRef.current.add(productKey);
      setPricingByProductKey((currentCache) => ({
        ...currentCache,
        [productKey]: {
          status: 'loading',
        },
      }));

      try {
        const result = await fetchCartLinePricing(productKey);

        setPricingByProductKey((currentCache) => ({
          ...currentCache,
          [productKey]: result,
        }));
      } finally {
        pricingRequestsInFlightRef.current.delete(productKey);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      previewState === 'loading' ||
      !isHydrated ||
      configurableProductKeys.length === 0
    ) {
      return;
    }

    configurableProductKeys.forEach((productKey) => {
      void loadPricingForProductKey(productKey);
    });
  }, [
    configurableProductKeys,
    isHydrated,
    loadPricingForProductKey,
    previewState,
  ]);

  const activeConfigurationLine = useMemo<StandardCartLine | null>(() => {
    if (!activeConfigurationLineId) {
      return null;
    }

    const matchingLine = cart.lines.find(
      (line) => line.lineId === activeConfigurationLineId,
    );

    return matchingLine?.lineType === 'standard' ? matchingLine : null;
  }, [activeConfigurationLineId, cart.lines]);

  useEffect(() => {
    if (!activeConfigurationLineId) {
      return;
    }

    if (!activeConfigurationLine) {
      setActiveConfigurationLineId(null);
    }
  }, [activeConfigurationLine, activeConfigurationLineId]);

  const handleOpenConfigurationEditor = useCallback(
    (lineId: string) => {
      const matchingLine = standardLines.find((line) => line.lineId === lineId);

      if (matchingLine) {
        const currentPricingState =
          pricingByProductKeyRef.current[matchingLine.productKey] ??
          IDLE_PRICING_STATE;

        if (
          currentPricingState.status === 'idle' ||
          currentPricingState.status === 'error'
        ) {
          void loadPricingForProductKey(matchingLine.productKey, {
            force: currentPricingState.status === 'error',
          });
        }
      }

      setActiveConfigurationLineId(lineId);
    },
    [loadPricingForProductKey, standardLines],
  );

  const handleCloseConfigurationEditor = useCallback(() => {
    setActiveConfigurationLineId(null);
  }, []);

  const handleSaveConfiguration = useCallback(
    (lineId: string, nextLine: StandardCartLine) => {
      replaceStandardLine(lineId, nextLine);
      setActiveConfigurationLineId(null);
    },
    [replaceStandardLine],
  );

  const shouldShowLoadingState = previewState === 'loading' || !isHydrated;
  const shouldShowEmptyState =
    previewState === 'empty' ||
    (previewState !== 'content' && cart.lines.length === 0);
  const activeConfigurationPricingState = activeConfigurationLine
    ? (pricingByProductKey[activeConfigurationLine.productKey] ??
      IDLE_PRICING_STATE)
    : IDLE_PRICING_STATE;

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
                onReconfigure={
                  line.lineType === 'standard' &&
                  line.configurationSummary.length > 0
                    ? handleOpenConfigurationEditor
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

      <CartLineConfigurationModal
        isOpen={!!activeConfigurationLine}
        line={activeConfigurationLine}
        standardLines={standardLines}
        pricingState={activeConfigurationPricingState}
        onLoadPricing={loadPricingForProductKey}
        onClose={handleCloseConfigurationEditor}
        onSave={handleSaveConfiguration}
      />
    </main>
  );
}
