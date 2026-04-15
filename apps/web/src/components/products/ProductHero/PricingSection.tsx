'use client';

import { useCallback, useMemo, useState } from 'react';

import type { SanityRawImage } from '@/components/shared/Image';
import type { FormStateData } from '@/src/components/ui/FormStates';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import type {
  CompletePricingData,
  PricingSelection,
} from '@/src/global/supabase/types';

import AddToCartConfirmationModal from '../../ui/AddToCartConfirmationModal';
import Button from '../../ui/Button';
import ProductInquiryModal, {
  type ProductContext,
} from '../ProductInquiryModal';
import PricingConfigurator, {
  type ConfigurationData,
} from './PricingConfigurator';
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
  const [selection, setSelection] = useState<PricingSelection>({
    variantId: pricingData?.variants[0]?.id ?? null,
    selectedOptions: {},
    calculatedPrice: pricingData?.lowestPrice ?? 0,
  });

  // Handle selection changes from PricingConfigurator
  const handleSelectionChange = useCallback(
    (newSelection: PricingSelection) => {
      setSelection(newSelection);
    },
    [],
  );

  const selectedVariant = useMemo(
    () =>
      pricingData?.variants.find(
        (variant) => variant.id === selection.variantId,
      ) ??
      pricingData?.variants[0] ??
      null,
    [pricingData, selection.variantId],
  );

  const configData = useMemo<ConfigurationData>(() => {
    if (!selectedVariant) {
      return {
        basePrice: pricingData?.lowestPrice ?? 0,
        options: [],
        totalPrice: pricingData?.lowestPrice ?? 0,
      };
    }

    const options = [];

    if (pricingData?.hasMultipleModels && selectedVariant.model) {
      options.push({
        label: 'Model',
        value: selectedVariant.model,
        priceDelta: 0,
      });
    }

    selectedVariant.groups.forEach((group) => {
      const selectedValue = selection.selectedOptions[group.id];

      if (!selectedValue) return;

      if (group.input_type === 'select') {
        const value = group.values.find((item) => item.id === selectedValue);

        if (!value) return;

        options.push({
          label: group.name,
          value: value.name,
          priceDelta: value.price_delta_cents,
        });

        return;
      }

      if (group.input_type === 'numeric_step' && group.numeric_rule) {
        const numericValue = Number.parseFloat(selectedValue);
        let priceDelta = 0;

        if (!Number.isNaN(numericValue)) {
          const stepsAboveBase =
            (numericValue - group.numeric_rule.base_included_value) /
            group.numeric_rule.step_value;

          if (stepsAboveBase > 0) {
            priceDelta =
              Math.ceil(stepsAboveBase) *
              group.numeric_rule.price_per_step_cents;
          }
        }

        options.push({
          label: group.name,
          value: `${selectedValue} ${group.unit || 'm'}`,
          priceDelta,
        });
      }
    });

    return {
      basePrice: selectedVariant.base_price_cents,
      options,
      totalPrice: selection.calculatedPrice,
    };
  }, [
    pricingData?.hasMultipleModels,
    pricingData?.lowestPrice,
    selectedVariant,
    selection,
  ]);

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
