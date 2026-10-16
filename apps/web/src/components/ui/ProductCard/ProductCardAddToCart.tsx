'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  loadProductQuickAdd,
  type LoadProductQuickAddResult,
} from '@/src/app/actions/product-quick-add';
import ProductQuickAddModal from '@/src/components/b2c/CartLineConfigurationModal/ProductQuickAddModal';
import type { SanityRawImage } from '@/src/components/shared/Image';
import { trackAddToCart } from '@/src/global/b2c/analytics/commerce-events';
import {
  createQuickAddCartLine,
  QUICK_ADD_ERROR_MESSAGE,
  QUICK_ADD_INVALID_CONFIGURATION_MESSAGE,
  QUICK_ADD_VARIANT_MISSING_MESSAGE,
  type QuickAddProductSnapshot,
  type QuickAddResolution,
} from '@/src/global/b2c/cart/quick-add';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import type { CompletePricingData } from '@/src/global/supabase/types';

import AddToCartConfirmationModal from '../AddToCartConfirmationModal';
import Button from '../Button';

type ProductCardAddToCartProps = {
  /** Product route slug, e.g. "/produkty/playermini/". */
  slug: string;
  productName: string;
  brandName: string;
  className?: string;
};

type ConfirmationProduct = {
  name: string;
  brandName: string;
  image: SanityRawImage;
  totalPrice: number | null;
};

type QuickAddConfiguration = {
  product: QuickAddProductSnapshot;
  pricingData: CompletePricingData;
};

/**
 * Client island rendered next to (never inside) the tile's stretched link.
 * The click loads pricing + product snapshot through a server action; a
 * product with a single variant and no options is added straight away,
 * anything configurable opens the configuration popup.
 *
 * Both modals are portals, but React events from a portal still bubble
 * through the React tree; keeping this component outside the <Link> means a
 * click inside a modal (or on its backdrop) never navigates to the product.
 */
export default function ProductCardAddToCart({
  slug,
  productName,
  brandName,
  className,
}: ProductCardAddToCartProps) {
  const { addLine, isHydrated } = useCart();
  const [isPending, setIsPending] = useState(false);
  const isPendingRef = useRef(false);
  // A successful lookup is reused on the next click (no second request).
  const [resolution, setResolution] = useState<QuickAddResolution | null>(null);
  const [confirmationProduct, setConfirmationProduct] =
    useState<ConfirmationProduct | null>(null);
  const [quickAddConfiguration, setQuickAddConfiguration] =
    useState<QuickAddConfiguration | null>(null);
  const isConfirmationOpen = confirmationProduct !== null;
  const isQuickAddOpen = quickAddConfiguration !== null;
  const isAnyModalOpen = isConfirmationOpen || isQuickAddOpen;
  const isAnyModalOpenRef = useRef(isAnyModalOpen);
  const shouldCloseModalsOnRestoreRef = useRef(false);

  useLayoutEffect(() => {
    isAnyModalOpenRef.current = isAnyModalOpen;
  }, [isAnyModalOpen]);

  // Same as the product page: when the page is restored from the router
  // cache (e.g. back from /koszyk/), do not show a stale confirmation or
  // a stale "Dodano" popup.
  useLayoutEffect(() => {
    if (shouldCloseModalsOnRestoreRef.current) {
      shouldCloseModalsOnRestoreRef.current = false;
      setConfirmationProduct(null);
      setQuickAddConfiguration(null);
    }

    return () => {
      shouldCloseModalsOnRestoreRef.current = isAnyModalOpenRef.current;
    };
  }, []);

  const handleCloseConfirmation = useCallback(() => {
    setConfirmationProduct(null);
  }, []);

  const handleCloseQuickAdd = useCallback(() => {
    setQuickAddConfiguration(null);
  }, []);

  const handleResult = (result: LoadProductQuickAddResult) => {
    if (result.status !== 'ready') {
      toast.error(result.message);
      return;
    }

    if (result.mode === 'configure') {
      setQuickAddConfiguration({
        product: result.product,
        pricingData: result.pricingData,
      });
      return;
    }

    const lineResult = createQuickAddCartLine({
      product: result.product,
      pricingData: result.pricingData,
    });

    if (!lineResult.ok) {
      toast.error(
        lineResult.reason === 'variant_missing'
          ? QUICK_ADD_VARIANT_MISSING_MESSAGE
          : QUICK_ADD_INVALID_CONFIGURATION_MESSAGE,
      );
      return;
    }

    addLine(lineResult.line);
    trackAddToCart(lineResult.line);
    setConfirmationProduct({
      name: result.product.name,
      brandName: result.product.brandName,
      image: result.product.image,
      totalPrice: lineResult.configData.totalPrice,
    });
  };

  const handleClick = async () => {
    // Adding before the cart is hydrated from storage would be overwritten.
    if (!isHydrated || isPendingRef.current) return;

    if (resolution) {
      handleResult(resolution);
      return;
    }

    isPendingRef.current = true;
    setIsPending(true);

    let result: LoadProductQuickAddResult;

    try {
      result = await loadProductQuickAdd(slug);
    } catch (error) {
      console.error('Product quick add request failed.', error);
      result = { status: 'error', message: QUICK_ADD_ERROR_MESSAGE };
    } finally {
      isPendingRef.current = false;
      setIsPending(false);
    }

    if (result.status !== 'error') {
      setResolution(result);
    }

    handleResult(result);
  };

  const accessibleName = [brandName, productName].filter(Boolean).join(' ');

  return (
    <>
      <Button
        type="button"
        text="Dodaj do koszyka"
        variant="primary"
        iconUsed="addToCart"
        aria-label={
          accessibleName
            ? `Dodaj do koszyka: ${accessibleName}`
            : 'Dodaj do koszyka'
        }
        isLoading={isPending}
        // While loading, keep the button focusable (a disabled button drops
        // keyboard focus); the pending ref blocks double clicks instead.
        disabled={!isHydrated}
        aria-disabled={isPending || undefined}
        onClick={handleClick}
        className={className}
      />
      <AddToCartConfirmationModal
        isOpen={isConfirmationOpen}
        product={
          confirmationProduct ?? {
            name: productName,
            brandName,
            image: {},
            totalPrice: null,
          }
        }
        onClose={handleCloseConfirmation}
      />
      {quickAddConfiguration ? (
        <ProductQuickAddModal
          isOpen={isQuickAddOpen}
          product={quickAddConfiguration.product}
          pricingData={quickAddConfiguration.pricingData}
          onClose={handleCloseQuickAdd}
        />
      ) : null}
    </>
  );
}
