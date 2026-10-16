'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import Image from '@/components/shared/Image';
import CartLineConfigurator, {
  type ConfigurationData,
} from '@/src/components/b2c/CartLineConfigurationModal/CartLineConfigurator';
import Button from '@/src/components/ui/Button';
import { trackAddToCart } from '@/src/global/b2c/analytics/commerce-events';
import {
  createQuickAddCartLine,
  QUICK_ADD_INVALID_CONFIGURATION_MESSAGE,
  QUICK_ADD_VARIANT_MISSING_MESSAGE,
  type QuickAddProductSnapshot,
} from '@/src/global/b2c/cart/quick-add';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import {
  buildStandardConfigurationData,
  createStandardConfigurationSelectionState,
  type StandardConfigurationSelectionSeed,
} from '@/src/global/b2c/configuration/standard-configuration';
import { useDialogA11y } from '@/src/global/hooks/useDialogA11y';
import type {
  CompletePricingData,
  PricingSelection,
} from '@/src/global/supabase/types';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

type ProductQuickAddModalProps = {
  isOpen: boolean;
  product: QuickAddProductSnapshot;
  pricingData: CompletePricingData;
  onClose: () => void;
};

type QuickAddDraft = {
  selection: StandardConfigurationSelectionSeed;
  configData: ConfigurationData;
};

/**
 * Configuration popup opened from a product tile ("Dodaj do koszyka" on a
 * product with several variants or option groups). It reuses the cart
 * configurator; nothing is stored until the shopper confirms, so closing
 * never asks for confirmation. After adding, the popup closes and a toast
 * confirms it (focus returns to the tile button).
 */
export default function ProductQuickAddModal({
  isOpen,
  product,
  pricingData,
  onClose,
}: ProductQuickAddModalProps) {
  if (!isOpen) {
    return null;
  }

  // The dialog body is mounted only while open, so every opening starts
  // from a fresh configuration (default variant and options).
  return createPortal(
    <ProductQuickAddDialog
      product={product}
      pricingData={pricingData}
      onClose={onClose}
    />,
    document.body,
  );
}

function ProductQuickAddDialog({
  product,
  pricingData,
  onClose,
}: Omit<ProductQuickAddModalProps, 'isOpen'>) {
  const { addLine } = useCart();
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayPointerDownRef = useRef(false);
  const hasAddedRef = useRef(false);
  const [draft, setDraft] = useState<QuickAddDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useDialogA11y({
    isOpen: true,
    containerRef: modalRef,
    initialFocusRef: modalRef,
    onEscape: onClose,
  });

  // Price shown before the configurator reports its first selection (it
  // settles the same defaults right after mounting).
  const defaultConfigData = useMemo(
    () =>
      buildStandardConfigurationData(
        pricingData,
        createStandardConfigurationSelectionState(pricingData, {
          variantId: null,
          selectedOptions: {},
        }),
      ),
    [pricingData],
  );

  // Must stay stable: CartLineConfigurator lists it in an effect dependency.
  const handleSelectionChange = useCallback(
    (selection: PricingSelection, configData: ConfigurationData) => {
      setDraft({
        selection: {
          variantId: selection.variantId,
          selectedOptions: { ...selection.selectedOptions },
        },
        configData,
      });
      setErrorMessage(null);
    },
    [],
  );

  const handleAddToCart = () => {
    if (!draft || hasAddedRef.current) {
      return;
    }

    const result = createQuickAddCartLine({
      product,
      pricingData,
      selection: draft.selection,
    });

    if (!result.ok) {
      setErrorMessage(
        result.reason === 'variant_missing'
          ? QUICK_ADD_VARIANT_MISSING_MESSAGE
          : QUICK_ADD_INVALID_CONFIGURATION_MESSAGE,
      );
      return;
    }

    hasAddedRef.current = true;
    addLine(result.line);
    trackAddToCart(result.line);
    toast.success('Produkt został dodany do koszyka');
    onClose();
  };

  // Close only when the press both started and ended on the backdrop, so a
  // text selection dragged out of the panel does not dismiss it.
  const handleOverlayPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    overlayPointerDownRef.current = event.target === event.currentTarget;
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // The portal still bubbles through the React tree (the tile); clicks in
    // the popup have nothing to do there.
    event.stopPropagation();
    const startedOnOverlay = overlayPointerDownRef.current;
    overlayPointerDownRef.current = false;

    if (startedOnOverlay && event.target === event.currentTarget) {
      onClose();
    }
  };

  const totalPrice =
    draft?.configData.totalPrice ?? defaultConfigData.totalPrice;

  return (
    <div
      className={`${styles.configuratorOverlay} ${styles.quickAddOverlay}`}
      onPointerDown={handleOverlayPointerDown}
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className={styles.configuratorModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <button
          type="button"
          className={styles.configuratorCloseButton}
          onClick={onClose}
          aria-label="Zamknij okno"
        >
          <CloseIcon />
        </button>

        <div className={styles.quickAddContent}>
          <div className={styles.configuratorHeader}>
            <h2 id={titleId} className={styles.configuratorTitle}>
              Wybierz konfigurację
            </h2>
            <p id={descriptionId} className={styles.configuratorDescription}>
              Wybierz wersję i opcje produktu, a potem dodaj go do koszyka.
            </p>
          </div>

          <div className={styles.configuratorProductCard}>
            <div className={styles.configuratorProductImage}>
              <Image image={product.image} sizes="96px" alt="" />
            </div>

            <div className={styles.configuratorProductMeta}>
              {product.brandName ? (
                <span className={styles.configuratorProductBrand}>
                  {product.brandName}
                </span>
              ) : null}
              <span className={styles.configuratorProductName}>
                {product.name}
              </span>
            </div>

            <div
              className={styles.configuratorProductPriceBlock}
              aria-live="polite"
              aria-atomic="true"
            >
              <span className={styles.configuratorProductDetails}>
                Cena konfiguracji
              </span>
              <span className={styles.configuratorProductPrice}>
                {formatPrice(totalPrice)}
              </span>
            </div>
          </div>

          <div className={styles.configuratorBody}>
            <CartLineConfigurator
              pricingData={pricingData}
              initialSelection={null}
              onSelectionChange={handleSelectionChange}
            />
            {errorMessage ? (
              <p className={styles.quickAddError} role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className={`${styles.configuratorActions} ${styles.quickAddFooter}`}
        >
          <Button
            type="button"
            variant="secondary"
            iconUsed="arrowLeft"
            onClick={onClose}
          >
            Anuluj
          </Button>
          <Button
            type="button"
            variant="primary"
            iconUsed="addToCart"
            onClick={handleAddToCart}
            disabled={!draft}
          >
            Dodaj do koszyka
          </Button>
        </div>
      </div>
    </div>
  );
}

const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
