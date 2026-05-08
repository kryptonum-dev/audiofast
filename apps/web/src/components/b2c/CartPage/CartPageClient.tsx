'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { fetchCartLinePricing } from '@/src/app/actions/cart-pricing';
import { loadCartPageRuntime } from '@/src/app/actions/cart-revalidation';
import CartLineConfigurationModal from '@/src/components/b2c/CartLineConfigurationModal';
import type { CartLinePricingCacheEntry } from '@/src/components/b2c/CartLineConfigurationModal/pricing-cache';
import { applyCartRevalidation as applyCartRevalidationToState } from '@/src/global/b2c/cart/cart-revalidation';
import {
  getCartVisibleLineDiscountCents,
  getCheckoutCartTotals,
} from '@/src/global/b2c/cart/cart-selectors';
import {
  canKeepStandardLineWithoutOptions,
  canReconfigureStandardLineWithAddedOptions,
  createStandardCartLineWithoutOptions,
} from '@/src/global/b2c/cart/standard-cart-line-option-recovery';
import type { StandardCartLine } from '@/src/global/b2c/cart/types';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import {
  isOnlinePaymentAmountOverLimit,
  ONLINE_PAYMENT_LIMIT_MESSAGE,
} from '@/src/global/b2c/checkout/payment-limit';

import CartEmptyState from './CartEmptyState';
import CartItemCard from './CartItemCard';
import CartLoadingSkeleton from './CartLoadingSkeleton';
import CartSidebar from './CartSidebar';
import styles from './styles.module.scss';
import type { CartEmptyStateData, SupportCardData } from './types';

type CartPageClientProps = {
  supportCard?: SupportCardData | null;
  emptyStateContent?: CartEmptyStateData | null;
  previewState?: 'loading' | 'empty' | 'content';
};

const IDLE_PRICING_STATE: CartLinePricingCacheEntry = {
  status: 'idle',
};

const CHECKOUT_PATH = '/koszyk/twoje-dane';

export default function CartPageClient({
  supportCard = null,
  emptyStateContent = null,
  previewState,
}: CartPageClientProps) {
  const pathname = usePathname();
  const router = useRouter();
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
    applyCartLineRevalidation,
    applyCoupon,
    revalidateHydratedCouponAfterInitialLoad,
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
  const [isCartRuntimeLoading, setIsCartRuntimeLoading] = useState(false);
  const [isCheckoutPending, setIsCheckoutPending] = useState(false);
  const pricingByProductKeyRef = useRef(pricingByProductKey);
  const pricingRequestsInFlightRef = useRef<Set<string>>(new Set());
  const hasLoadedCartRuntimeRef = useRef(false);
  const previousPathnameRef = useRef(pathname);
  const isCartInteractionPending = isCartRuntimeLoading || isCheckoutPending;

  const handleCheckout = useCallback(async () => {
    if (isCartInteractionPending || cart.lines.length === 0) {
      return;
    }

    setIsCheckoutPending(true);

    try {
      const runtime = await loadCartPageRuntime(cart.lines);
      const revalidatedCart = applyCartRevalidationToState(
        cart,
        runtime.revalidationResults,
      );

      applyCartLineRevalidation(runtime.revalidationResults);
      setPricingByProductKey(runtime.standardPricingByProductKey);

      const hasBlockingLine = runtime.revalidationResults.some((result) => {
        if (result.lineType === 'standard') {
          return !result.isBuyable || !result.isConfigurationValid;
        }

        return !result.isBuyable || result.availabilityStatus !== 'available';
      });

      if (hasBlockingLine) {
        return;
      }

      if (
        isOnlinePaymentAmountOverLimit(
          getCheckoutCartTotals(revalidatedCart).grandTotalCents,
        )
      ) {
        toast.error(ONLINE_PAYMENT_LIMIT_MESSAGE);
        return;
      }

      setIsCheckoutPending(false);
      router.push(CHECKOUT_PATH);
    } catch (error) {
      console.error('Unexpected checkout revalidation failure.', error);
    } finally {
      setIsCheckoutPending(false);
    }
  }, [applyCartLineRevalidation, cart, isCartInteractionPending, router]);
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

  const runCartRuntimeLoad = useCallback(async () => {
    if (
      previewState === 'loading' ||
      !isHydrated ||
      hasLoadedCartRuntimeRef.current ||
      cart.lines.length === 0
    ) {
      return;
    }

    hasLoadedCartRuntimeRef.current = true;
    setIsCartRuntimeLoading(true);

    try {
      const runtime = await loadCartPageRuntime(cart.lines);

      applyCartLineRevalidation(runtime.revalidationResults);
      setPricingByProductKey(runtime.standardPricingByProductKey);
    } catch (error) {
      console.error('Unexpected cart runtime load failure.', error);
    } finally {
      setIsCartRuntimeLoading(false);
      void revalidateHydratedCouponAfterInitialLoad();
    }
  }, [
    applyCartLineRevalidation,
    cart.lines,
    isHydrated,
    previewState,
    revalidateHydratedCouponAfterInitialLoad,
  ]);

  useEffect(() => {
    void runCartRuntimeLoad();
  }, [runCartRuntimeLoad]);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;

    if (pathname !== '/koszyk') {
      return;
    }

    setIsCheckoutPending(false);

    if (previousPathname === pathname) {
      return;
    }

    hasLoadedCartRuntimeRef.current = false;
    void runCartRuntimeLoad();
  }, [pathname, runCartRuntimeLoad]);

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
  const handleKeepWithoutOptions = useCallback(
    (lineId: string) => {
      const matchingLine = standardLines.find((line) => line.lineId === lineId);

      if (!matchingLine) {
        return;
      }

      const pricingState =
        pricingByProductKeyRef.current[matchingLine.productKey];

      if (pricingState?.status !== 'found') {
        return;
      }

      const recoveredLine = createStandardCartLineWithoutOptions(
        matchingLine,
        pricingState.pricingData,
      );

      if (!recoveredLine) {
        return;
      }

      replaceStandardLine(lineId, recoveredLine);
    },
    [replaceStandardLine, standardLines],
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
            {cart.lines.map((line) => {
              const pricingState =
                line.lineType === 'standard'
                  ? (pricingByProductKey[line.productKey] ?? IDLE_PRICING_STATE)
                  : IDLE_PRICING_STATE;
              const hasBlockingConfigurationIssue = line.issues.some(
                (issue) =>
                  issue.blocking && issue.code === 'configuration_invalid',
              );
              const shouldOfferKeepWithoutOptions =
                line.lineType === 'standard' &&
                hasBlockingConfigurationIssue &&
                !isCartInteractionPending &&
                pricingState.status === 'found' &&
                canKeepStandardLineWithoutOptions(
                  line,
                  pricingState.pricingData,
                );
              const shouldOfferReconfigureAddedOptions =
                line.lineType === 'standard' &&
                hasBlockingConfigurationIssue &&
                !isCartInteractionPending &&
                pricingState.status === 'found' &&
                !shouldOfferKeepWithoutOptions &&
                canReconfigureStandardLineWithAddedOptions(
                  line,
                  pricingState.pricingData,
                );

              return (
                <CartItemCard
                  key={line.lineId}
                  line={line}
                  lineDiscountCents={getCartVisibleLineDiscountCents(
                    cart,
                    line.lineId,
                  )}
                  isInteractionDisabled={isCartInteractionPending}
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
                    (line.configurationSummary.length > 0 ||
                      shouldOfferReconfigureAddedOptions) &&
                    !shouldOfferKeepWithoutOptions
                      ? handleOpenConfigurationEditor
                      : undefined
                  }
                  onKeepWithoutOptions={
                    shouldOfferKeepWithoutOptions
                      ? handleKeepWithoutOptions
                      : undefined
                  }
                />
              );
            })}
          </div>

          <CartSidebar
            cart={cart}
            totals={totals}
            supportCard={supportCard}
            onCheckout={handleCheckout}
            isCartRuntimeLoading={isCartInteractionPending}
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
