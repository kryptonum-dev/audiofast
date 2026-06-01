'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { SanityRawImage } from '@/components/shared/Image';
import type { FormStateData } from '@/src/components/ui/FormStates';
import { trackAddToCart } from '@/src/global/b2c/analytics/commerce-events';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import {
  buildStandardConfigurationData,
  createStandardConfigurationSelectionState,
  resolveStandardConfigurationVariant,
  type StandardConfigurationData,
} from '@/src/global/b2c/configuration/standard-configuration';
import type {
  CompletePricingData,
  PricingSelection,
} from '@/src/global/supabase/types';

import AddToCartConfirmationModal from '../../ui/AddToCartConfirmationModal';
import Button from '../../ui/Button';
import ProductInquiryModal, {
  type ProductContext,
} from '../ProductInquiryModal';
import PricingConfigurator from './PricingConfigurator';
import styles from './styles.module.scss';

interface PricingSectionProps {
  pricingData?: CompletePricingData | null;
  isBuyable: boolean;
  product: {
    id: string;
    name: string;
    brandName: string;
    isReturnable: boolean;
    brandLogo?: SanityRawImage;
    image: SanityRawImage;
  };
  formStateData?: FormStateData | null;
  onAddToCart?: (product: ReturnType<typeof createStandardCartLine>) => void;
}

export default function PricingSection({
  pricingData,
  isBuyable,
  product,
  formStateData,
  onAddToCart,
}: PricingSectionProps) {
  const { addLine } = useCart();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const isConfirmationOpenRef = useRef(isConfirmationOpen);
  const shouldCloseConfirmationOnRestoreRef = useRef(false);
  const [selection, setSelection] = useState<PricingSelection>(() =>
    pricingData
      ? createStandardConfigurationSelectionState(pricingData)
      : {
          variantId: null,
          selectedOptions: {},
          calculatedPrice: 0,
        },
  );

  useEffect(() => {
    setSelection(
      pricingData
        ? createStandardConfigurationSelectionState(pricingData)
        : {
            variantId: null,
            selectedOptions: {},
            calculatedPrice: 0,
          },
    );
  }, [pricingData]);

  useLayoutEffect(() => {
    isConfirmationOpenRef.current = isConfirmationOpen;
  }, [isConfirmationOpen]);

  useLayoutEffect(() => {
    if (shouldCloseConfirmationOnRestoreRef.current) {
      shouldCloseConfirmationOnRestoreRef.current = false;
      setIsConfirmationOpen(false);
    }

    return () => {
      shouldCloseConfirmationOnRestoreRef.current =
        isConfirmationOpenRef.current;
    };
  }, []);

  // Handle selection changes from PricingConfigurator
  const handleSelectionChange = useCallback(
    (newSelection: PricingSelection) => {
      setSelection(newSelection);
    },
    [],
  );

  const selectedVariant = useMemo(
    () =>
      pricingData
        ? resolveStandardConfigurationVariant(pricingData, selection.variantId)
        : null,
    [pricingData, selection.variantId],
  );

  const configData = useMemo<StandardConfigurationData>(
    () =>
      pricingData
        ? buildStandardConfigurationData(pricingData, selection)
        : {
            basePrice: 0,
            options: [],
            totalPrice: 0,
          },
    [pricingData, selection],
  );

  // Build product context for the modal
  const productContext: ProductContext = {
    id: product.id,
    name: product.name,
    brandName: product.brandName,
    kind: 'standard',
    brandLogo: product.brandLogo,
    image: product.image,
    basePrice: selectedVariant ? configData.basePrice : null,
    configurationOptions: configData.options.map((opt) => ({
      label: opt.label,
      value: opt.value,
      priceDelta: opt.priceDelta,
    })),
    totalPrice: selectedVariant ? configData.totalPrice : null,
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleAddToCart = () => {
    if (!selectedVariant) return;

    const line = createStandardCartLine({
      productId: product.id,
      productKey: selectedVariant.price_key,
      productName: product.name,
      brandName: product.brandName,
      quantity: 1,
      unitPriceCents: productContext.totalPrice ?? 0,
      isReturnable: product.isReturnable,
      configurationSelection: {
        variantId: selection.variantId,
        selectedOptions: selection.selectedOptions,
      },
      product: {
        ...productContext,
        basePrice: configData.basePrice,
        totalPrice: configData.totalPrice,
      },
    });

    addLine(line);
    trackAddToCart(line);
    onAddToCart?.(line);
    setIsConfirmationOpen(true);
  };

  const handleCloseConfirmation = () => {
    setIsConfirmationOpen(false);
  };

  return (
    <>
      {pricingData ? (
        <PricingConfigurator
          pricingData={pricingData}
          onSelectionChange={handleSelectionChange}
        />
      ) : null}
      <div className={styles.buttonsWrapper}>
        {isBuyable ? (
          <Button
            text="Dodaj do koszyka"
            variant="primary"
            iconUsed="addToCart"
            onClick={handleAddToCart}
            className={styles.inquiryButton}
          />
        ) : null}

        <Button
          text="Zapytaj o produkt"
          variant={isBuyable ? 'secondary' : 'primary'}
          iconUsed="information"
          onClick={handleOpenModal}
          className={styles.inquiryButton}
        />
      </div>
      <ProductInquiryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        product={productContext}
        formStateData={formStateData}
      />
      <AddToCartConfirmationModal
        isOpen={isConfirmationOpen}
        product={{
          name: productContext.name,
          brandName: productContext.brandName,
          image: productContext.image,
          totalPrice: productContext.totalPrice,
        }}
        onClose={handleCloseConfirmation}
      />
    </>
  );
}
