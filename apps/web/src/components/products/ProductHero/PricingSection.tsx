'use client';

import { useCallback, useState } from 'react';

import type { SanityRawImage } from '@/components/shared/Image';
import type { FormStateData } from '@/src/components/ui/FormStates';
import type {
  CompletePricingData,
  PricingSelection,
} from '@/src/global/supabase/types';

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
    brandLogo?: SanityRawImage;
    image: SanityRawImage;
  };
  formStateData?: FormStateData | null;
  onAddToCart?: (product: ProductContext) => void;
}

export default function PricingSection({
  pricingData,
  isBuyable,
  product,
  formStateData,
  onAddToCart,
}: PricingSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [configData, setConfigData] = useState<ConfigurationData>({
    basePrice: pricingData?.lowestPrice ?? 0,
    options: [],
    totalPrice: pricingData?.lowestPrice ?? 0,
  });

  // Handle selection changes from PricingConfigurator
  const handleSelectionChange = useCallback(
    (_selection: PricingSelection, newConfigData: ConfigurationData) => {
      setConfigData(newConfigData);
    },
    [],
  );

  // Build product context for the modal
  const productContext: ProductContext = {
    id: product.id,
    name: product.name,
    brandName: product.brandName,
    kind: 'standard',
    brandLogo: product.brandLogo,
    image: product.image,
    basePrice: configData.basePrice,
    configurationOptions: configData.options.map((opt) => ({
      label: opt.label,
      value: opt.value,
      priceDelta: opt.priceDelta,
    })),
    totalPrice: configData.totalPrice,
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleAddToCart = () => {
    onAddToCart?.(productContext);
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
            iconUsed="arrowRight"
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
    </>
  );
}
