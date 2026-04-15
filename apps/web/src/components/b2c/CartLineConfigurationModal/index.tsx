'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import Image from '@/components/shared/Image';
import CartLineConfigurator, {
  type ConfigurationData,
} from '@/src/components/b2c/CartLineConfigurationModal/CartLineConfigurator';
import type { CartLinePricingCacheEntry } from '@/src/components/b2c/CartLineConfigurationModal/pricing-cache';
import Button from '@/src/components/ui/Button';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import {
  createStandardCartLineConfigurationSource,
  type StandardCartLineConfigurationSource,
} from '@/src/global/b2c/cart/standard-cart-line-configuration-source';
import type {
  StandardCartConfigurationSelection,
  StandardCartLine,
} from '@/src/global/b2c/cart/types';
import type {
  PricingSelection,
  PricingVariantWithOptions,
} from '@/src/global/supabase/types';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

type CartLineConfigurationModalProps = {
  isOpen: boolean;
  line: StandardCartLine | null;
  standardLines: StandardCartLine[];
  pricingState: CartLinePricingCacheEntry;
  onLoadPricing: (productKey: string, options?: { force?: boolean }) => void;
  onClose: () => void;
  onSave: (lineId: string, nextLine: StandardCartLine) => void;
};

function getSourceNotice(
  source: StandardCartLineConfigurationSource | null,
): string | null {
  if (!source) {
    return null;
  }

  switch (source.status) {
    case 'missing_selection':
      return 'Ta pozycja pochodzi ze starszej wersji koszyka, więc otworzyliśmy konfigurator od ustawień domyślnych.';
    case 'variant_unavailable':
      return 'Poprzednio wybrana konfiguracja nie jest już dostępna. Wybierz nową i zapisz pozycję ponownie.';
    case 'ready':
      return null;
  }
}

function mapDraftSelection(
  selection: PricingSelection,
): StandardCartConfigurationSelection {
  return {
    variantId: selection.variantId,
    selectedOptions: { ...selection.selectedOptions },
  };
}

function createDraftFingerprint(
  selection: StandardCartConfigurationSelection,
  configData: ConfigurationData,
): string {
  const sortedSelectedOptions = Object.fromEntries(
    Object.entries(selection.selectedOptions).sort(([leftKey], [rightKey]) =>
      leftKey.localeCompare(rightKey),
    ),
  );

  return JSON.stringify({
    variantId: selection.variantId,
    selectedOptions: sortedSelectedOptions,
    totalPrice: configData.totalPrice,
  });
}

function mapDraftProduct(
  line: StandardCartLine,
  configData: ConfigurationData,
): StandardCartLine['product'] {
  return {
    ...line.product,
    kind: 'standard',
    basePrice: configData.basePrice,
    configurationOptions: configData.options.map((option) => ({
      label: option.label,
      value: option.value,
      priceDelta: option.priceDelta,
    })),
    totalPrice: configData.totalPrice,
  };
}

export default function CartLineConfigurationModal({
  isOpen,
  line,
  standardLines,
  pricingState,
  onLoadPricing,
  onClose,
  onSave,
}: CartLineConfigurationModalProps) {
  const [mounted, setMounted] = useState(false);
  const [draftSelection, setDraftSelection] =
    useState<StandardCartConfigurationSelection | null>(null);
  const [draftConfigData, setDraftConfigData] =
    useState<ConfigurationData | null>(null);
  const [initialDraftFingerprint, setInitialDraftFingerprint] = useState<
    string | null
  >(null);
  const [activePrompt, setActivePrompt] = useState<'discard' | 'merge' | null>(
    null,
  );
  const hasCapturedInitialDraftRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !line) {
      setDraftSelection(null);
      setDraftConfigData(null);
      setInitialDraftFingerprint(null);
      setActivePrompt(null);
      hasCapturedInitialDraftRef.current = false;
      return;
    }
    setDraftSelection(null);
    setDraftConfigData(null);
    setInitialDraftFingerprint(null);
    setActivePrompt(null);
    hasCapturedInitialDraftRef.current = false;
  }, [isOpen, line]);

  useEffect(() => {
    if (!isOpen || !line) {
      return;
    }

    if (pricingState.status === 'idle') {
      onLoadPricing(line.productKey);
    }
  }, [isOpen, line, onLoadPricing, pricingState.status]);

  const configurationSource = useMemo(() => {
    if (!line || pricingState.status !== 'found') {
      return null;
    }

    return createStandardCartLineConfigurationSource(
      line,
      pricingState.pricingData,
    );
  }, [line, pricingState]);

  const sourceNotice = useMemo(
    () => getSourceNotice(configurationSource),
    [configurationSource],
  );

  const initialSelection = useMemo(() => {
    if (configurationSource?.status !== 'ready') {
      return null;
    }

    return configurationSource.initialSelection;
  }, [configurationSource]);

  const selectedVariant = useMemo<PricingVariantWithOptions | null>(() => {
    if (pricingState.status !== 'found' || !draftSelection?.variantId) {
      return null;
    }

    return (
      pricingState.pricingData.variants.find(
        (variant) => variant.id === draftSelection.variantId,
      ) ?? null
    );
  }, [draftSelection?.variantId, pricingState]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialDraftFingerprint || !draftSelection || !draftConfigData) {
      return false;
    }

    return (
      createDraftFingerprint(draftSelection, draftConfigData) !==
      initialDraftFingerprint
    );
  }, [draftConfigData, draftSelection, initialDraftFingerprint]);

  const nextLinePreview = useMemo(() => {
    if (!line || !selectedVariant || !draftSelection || !draftConfigData) {
      return null;
    }

    return createStandardCartLine({
      lineId: line.lineId,
      productId: line.productId,
      productKey: selectedVariant.price_key,
      productName: line.productName,
      brandName: line.brandName,
      quantity: line.quantity,
      unitPriceCents: draftConfigData.totalPrice,
      isReturnable: line.isReturnable,
      configurationSelection: draftSelection,
      product: mapDraftProduct(line, draftConfigData),
    });
  }, [draftConfigData, draftSelection, line, selectedVariant]);

  const mergeTargetLine = useMemo(() => {
    if (!line || !nextLinePreview) {
      return null;
    }

    return (
      standardLines.find(
        (standardLine) =>
          standardLine.lineId !== line.lineId &&
          standardLine.productKey === nextLinePreview.productKey &&
          standardLine.configurationSignature ===
            nextLinePreview.configurationSignature,
      ) ?? null
    );
  }, [line, nextLinePreview, standardLines]);

  const handleSelectionChange = useCallback(
    (selection: PricingSelection, configData: ConfigurationData) => {
      if (!selection.variantId) {
        setDraftSelection(null);
        setDraftConfigData(null);
        return;
      }

      const nextDraftSelection = mapDraftSelection(selection);

      if (!hasCapturedInitialDraftRef.current) {
        setInitialDraftFingerprint(
          createDraftFingerprint(nextDraftSelection, configData),
        );
        hasCapturedInitialDraftRef.current = true;
      }

      setDraftSelection(nextDraftSelection);
      setDraftConfigData(configData);
    },
    [],
  );

  const handleKeepEditing = useCallback(() => {
    setActivePrompt(null);
  }, []);

  const handleConfirmDiscard = useCallback(() => {
    setActivePrompt(null);
    onClose();
  }, [onClose]);

  const performSave = useCallback(
    (nextLine: StandardCartLine) => {
      if (!line) {
        return;
      }

      setActivePrompt(null);
      onSave(line.lineId, nextLine);
      toast.success('Konfiguracja produktu została zaktualizowana.');
      onClose();
    },
    [line, onClose, onSave],
  );

  const handleConfirmMergeSave = useCallback(() => {
    if (!nextLinePreview) {
      return;
    }

    performSave(nextLinePreview);
  }, [nextLinePreview, performSave]);

  const handleRequestClose = useCallback(() => {
    if (activePrompt === 'merge') {
      setActivePrompt(null);
      return;
    }

    if (hasUnsavedChanges) {
      setActivePrompt('discard');
      return;
    }

    onClose();
  }, [activePrompt, hasUnsavedChanges, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (activePrompt) {
          setActivePrompt(null);
          return;
        }

        handleRequestClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [activePrompt, handleRequestClose, isOpen]);

  const handleSave = useCallback(() => {
    if (!nextLinePreview) {
      return;
    }

    if (mergeTargetLine) {
      setActivePrompt('merge');
      return;
    }

    performSave(nextLinePreview);
  }, [mergeTargetLine, nextLinePreview, performSave]);

  if (!isOpen || !mounted || !line) {
    return null;
  }

  const previewPriceCents = draftConfigData?.totalPrice ?? line.unitPriceCents;
  const hasPriceChanged = previewPriceCents !== line.unitPriceCents;
  const promptContent =
    activePrompt === 'discard'
      ? {
          title: 'Zamknąć bez zapisywania?',
          message:
            'Zmieniona konfiguracja tej pozycji nie została zapisana. Możesz wrócić do edycji albo odrzucić zmiany i zamknąć okno.',
          cancelText: 'Kontynuuj edycję',
          confirmText: 'Odrzuć zmiany',
          confirmIcon: 'trash' as const,
          onConfirm: handleConfirmDiscard,
        }
      : activePrompt === 'merge' && mergeTargetLine
        ? {
            title: 'Zapisać i połączyć pozycje?',
            message: (
              <>
                Ta konfiguracja jest już w koszyku jako osobna pozycja.
                Zapisanie zmian połączy obie pozycje i ustawi łączną ilość na{' '}
                <strong>{line.quantity + mergeTargetLine.quantity} szt.</strong>
              </>
            ),
            cancelText: 'Wróć do edycji',
            confirmText: 'Zapisz i połącz',
            confirmIcon: 'arrowUp' as const,
            onConfirm: handleConfirmMergeSave,
          }
        : null;

  return createPortal(
    <div
      className={styles.configuratorOverlay}
      onClick={handleRequestClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-configurator-title"
    >
      <div
        className={styles.configuratorModal}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.configuratorCloseButton}
          onClick={handleRequestClose}
          aria-label="Zamknij edycję konfiguracji"
        >
          <CloseIcon />
        </button>

        <div className={styles.configuratorHeader}>
          <h2 id="cart-configurator-title" className={styles.configuratorTitle}>
            Edytuj konfigurację
          </h2>
          <p className={styles.configuratorDescription}>
            Zmień wariant oraz wszystkie opcje tej pozycji bez opuszczania
            koszyka.
          </p>
        </div>

        <div className={styles.configuratorProductCard}>
          <div className={styles.configuratorProductImage}>
            <Image image={line.product.image} sizes="96px" alt="" />
          </div>

          <div className={styles.configuratorProductMeta}>
            <span className={styles.configuratorProductBrand}>
              {line.brandName}
            </span>
            <span className={styles.configuratorProductName}>
              {line.productName}
            </span>
            <span className={styles.configuratorProductDetails}>
              Ilość w koszyku: {line.quantity} szt.
            </span>
          </div>

          <div className={styles.configuratorProductPriceBlock}>
            {hasPriceChanged ? (
              <span className={styles.configuratorProductPricePrevious}>
                {formatPrice(line.unitPriceCents)}
              </span>
            ) : null}
            <span className={styles.configuratorProductPrice}>
              {formatPrice(previewPriceCents)}
            </span>
          </div>
        </div>

        {pricingState.status === 'idle' || pricingState.status === 'loading' ? (
          <div className={styles.configuratorLoadingState}>
            Wczytujemy aktualną konfigurację produktu...
          </div>
        ) : null}

        {pricingState.status === 'error' ||
        pricingState.status === 'not_found' ? (
          <div className={styles.configuratorErrorState}>
            <p className={styles.configuratorErrorMessage}>
              {pricingState.message}
            </p>

            <div className={styles.configuratorActions}>
              <Button
                type="button"
                variant="secondary"
                iconUsed="arrowLeft"
                onClick={handleRequestClose}
              >
                Zamknij
              </Button>
            </div>
          </div>
        ) : null}

        {pricingState.status === 'found' ? (
          <div className={styles.configuratorBody}>
            {sourceNotice ? (
              <p className={styles.configuratorNotice}>{sourceNotice}</p>
            ) : null}

            <CartLineConfigurator
              pricingData={pricingState.pricingData}
              initialSelection={initialSelection}
              onSelectionChange={handleSelectionChange}
            />

            <div className={styles.configuratorActions}>
              <Button
                type="button"
                variant="secondary"
                iconUsed="arrowLeft"
                onClick={handleRequestClose}
              >
                Anuluj
              </Button>
              <Button
                type="button"
                variant="primary"
                iconUsed="arrowUp"
                onClick={handleSave}
                disabled={
                  !selectedVariant || !draftSelection || !draftConfigData
                }
              >
                Zapisz konfigurację
              </Button>
            </div>
          </div>
        ) : null}

        {promptContent ? (
          <div
            className={styles.discardPromptOverlay}
            onClick={handleKeepEditing}
          >
            <div
              className={styles.discardPromptCard}
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className={styles.discardPromptTitle}>
                {promptContent.title}
              </h3>
              <p className={styles.discardPromptMessage}>
                {promptContent.message}
              </p>
              <div className={styles.discardPromptActions}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleKeepEditing}
                >
                  {promptContent.cancelText}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  iconUsed={promptContent.confirmIcon}
                  onClick={promptContent.onConfirm}
                >
                  {promptContent.confirmText}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
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
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
