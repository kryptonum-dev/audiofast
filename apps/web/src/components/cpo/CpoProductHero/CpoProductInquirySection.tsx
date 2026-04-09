'use client';

import { useMemo, useState } from 'react';

import ProductInquiryModal, {
  type ProductContext,
} from '@/src/components/products/ProductInquiryModal';
import type { SanityRawImage } from '@/src/components/shared/Image';
import Button from '@/src/components/ui/Button';
import type { FormStateData } from '@/src/components/ui/FormStates';
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
  isBuyable: boolean;
  formStateData?: FormStateData | null;
  onAddToCart?: (product: ProductContext) => void;
};

export default function CpoProductInquirySection({
  productId,
  productName,
  brandName,
  brandLogo,
  previewImage,
  priceCents,
  isBuyable,
  formStateData,
  onAddToCart,
}: CpoProductInquirySectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formattedPrice =
    typeof priceCents === 'number' && priceCents > 0
      ? formatPrice(priceCents)
      : 'Cena do ustalenia';

  const productContext = useMemo<ProductContext>(() => {
    const modalPreviewImage = previewImage ?? ({ id: null } as SanityRawImage);

    return {
      id: productId,
      name: productName,
      brandName: brandName || '',
      kind: 'cpo',
      brandLogo: brandLogo || undefined,
      image: modalPreviewImage,
      basePrice: priceCents ?? 0,
      configurationOptions: [],
      totalPrice: priceCents ?? 0,
    };
  }, [brandLogo, brandName, previewImage, priceCents, productId, productName]);

  const handleAddToCart = () => {
    onAddToCart?.(productContext);
  };

  return (
    <>
      <div
        className={`${productHeroStyles.priceWrapper} ${styles.priceWrapper}`}
      >
        <span className={styles.priceLabel}>Cena CPO</span>
        <span className={productHeroStyles.price}>{formattedPrice}</span>
        <div className={productHeroStyles.buttonsWrapper}>
          {isBuyable ? (
            <Button
              text="Dodaj do koszyka"
              variant="primary"
              iconUsed="arrowRight"
              onClick={handleAddToCart}
              className={productHeroStyles.inquiryButton}
            />
          ) : null}
          <Button
            text="Zapytaj o ten egzemplarz"
            variant={isBuyable ? 'secondary' : 'primary'}
            iconUsed="information"
            onClick={() => setIsModalOpen(true)}
            className={productHeroStyles.inquiryButton}
          />
        </div>
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
