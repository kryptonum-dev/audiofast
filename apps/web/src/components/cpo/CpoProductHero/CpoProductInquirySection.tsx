'use client';

import { useMemo, useState } from 'react';

import type { SanityRawImage } from '@/src/components/shared/Image';
import ProductInquiryModal, {
  type ProductContext,
} from '@/src/components/products/ProductInquiryModal';
import type { FormStateData } from '@/src/components/ui/FormStates';
import Button from '@/src/components/ui/Button';
import { formatPrice } from '@/src/global/utils';

import productHeroStyles from '../../products/ProductHero/styles.module.scss';
import styles from './styles.module.scss';

type CpoProductInquirySectionProps = {
  productId: string;
  productName: string;
  brandName?: string | null;
  brandLogo?: SanityRawImage | null;
  previewImage?: SanityRawImage | null;
  priceCents?: number | null;
  formStateData?: FormStateData | null;
};

export default function CpoProductInquirySection({
  productId,
  productName,
  brandName,
  brandLogo,
  previewImage,
  priceCents,
  formStateData,
}: CpoProductInquirySectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalPreviewImage = previewImage ?? ({ id: null } as SanityRawImage);
  const formattedPrice =
    typeof priceCents === 'number' && priceCents > 0
      ? formatPrice(priceCents)
      : 'Cena do ustalenia';

  const productContext = useMemo<ProductContext>(
    () => ({
      id: productId,
      name: productName,
      brandName: brandName || '',
      kind: 'cpo',
      brandLogo: brandLogo || undefined,
      image: modalPreviewImage,
      basePrice: priceCents ?? 0,
      configurationOptions: [],
      totalPrice: priceCents ?? 0,
    }),
    [brandLogo, brandName, modalPreviewImage, priceCents, productId, productName],
  );

  return (
    <>
      <div className={`${productHeroStyles.priceWrapper} ${styles.priceWrapper}`}>
        <span className={styles.priceLabel}>Cena CPO</span>
        <span className={productHeroStyles.price}>{formattedPrice}</span>
        <Button
          text="Zapytaj o ten egzemplarz"
          variant="primary"
          iconUsed="information"
          onClick={() => setIsModalOpen(true)}
          className={productHeroStyles.inquiryButton}
        />
      </div>

      <ProductInquiryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        product={productContext}
        formStateData={formStateData || undefined}
      />
    </>
  );
}
