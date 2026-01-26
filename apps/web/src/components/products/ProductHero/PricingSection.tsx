'use client';

import { useCallback, useState } from 'react';

import type { SanityRawImage } from '@/components/shared/Image';
import type { FormStateData } from '@/src/components/ui/FormStates';
import type { CompletePricingData, PricingSelection } from '@/src/global/supabase/types';

import Button from '../../ui/Button';
import ProductInquiryModal, {
  type ProductContext,
} from '../ProductInquiryModal';
import PricingConfigurator, {
  type ConfigurationData,
} from './PricingConfigurator';
import styles from './styles.module.scss';

interface PricingSectionProps {
  pricingData: CompletePricingData;
  product: {
    id: string;
    name: string;
    brandName: string;
    brandLogo?: SanityRawImage;
    image: SanityRawImage;
  };
  formStateData?: FormStateData | null;
}

export default function PricingSection({
  pricingData,
  product,
  formStateData,
}: PricingSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [configData, setConfigData] = useState<ConfigurationData>({
    basePrice: pricingData.lowestPrice,
    options: [],
    totalPrice: pricingData.lowestPrice,
  });

  // Handle selection changes from PricingConfigurator
  const handleSelectionChange = useCallback(
    (_selection: PricingSelection, newConfigData: ConfigurationData) => {
      setConfigData(newConfigData);
    },
    []
  );

  // Build product context for the modal
  const productContext: ProductContext = {
    id: product.id,
    name: product.name,
    brandName: product.brandName,
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

  return (
    <>
      <PricingConfigurator
        pricingData={pricingData}
        onSelectionChange={handleSelectionChange}
      />

      <Button
        text="Zapytaj o produkt"
        variant="primary"
        iconUsed="information"
        onClick={handleOpenModal}
        className={styles.inquiryButton}
      />

      <ProductInquiryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        product={productContext}
        formStateData={formStateData}
      />
    </>
  );
}
