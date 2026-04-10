'use client';

import { useMemo, useState } from 'react';

import ProductInquiryModal, {
  type ProductContext,
} from '@/src/components/products/ProductInquiryModal';
import type { SanityRawImage } from '@/src/components/shared/Image';
import AddToCartConfirmationModal from '@/src/components/ui/AddToCartConfirmationModal';
import Button from '@/src/components/ui/Button';
import type { FormStateData } from '@/src/components/ui/FormStates';
import { createCpoCartLine } from '@/src/global/b2c/cart/cpo-cart-line';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import { formatPrice } from '@/src/global/utils';

import productHeroStyles from '../../products/ProductHero/styles.module.scss';
import styles from './styles.module.scss';

type CpoProductInquirySectionProps = {
  productId: string;
  productKey: string;
  productName: string;
  brandName?: string | null;
  brandLogo?: SanityRawImage | null;
  previewImage?: SanityRawImage | null;
  priceCents?: number | null;
  isBuyable: boolean;
  isReturnable: boolean;
  formStateData?: FormStateData | null;
  onAddToCart?: (product: ReturnType<typeof createCpoCartLine>) => void;
  onGoToCart?: () => void;
};

export default function CpoProductInquirySection({
  productId,
  productKey,
  productName,
  brandName,
  brandLogo,
  previewImage,
  priceCents,
  isBuyable,
  isReturnable,
  formStateData,
  onAddToCart,
  onGoToCart,
}: CpoProductInquirySectionProps) {
  const { addLine, cart } = useCart();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const formattedPrice =
    typeof priceCents === 'number' && priceCents > 0
      ? formatPrice(priceCents)
      : 'Cena do ustalenia';
  const isAlreadyInCart = cart.lines.some(
    (line) => line.lineType === 'cpo' && line.productKey === productKey,
  );

  const productContext = useMemo<ProductContext>(() => {
    const modalPreviewImage = previewImage ?? ({ id: null } as SanityRawImage);

    return {
      id: productId,
      name: productName,
      brandName: brandName || '',
      kind: 'cpo',
      brandLogo: brandLogo || undefined,
      image: modalPreviewImage,
      basePrice: priceCents ?? null,
      configurationOptions: [],
      totalPrice: priceCents ?? null,
    };
  }, [brandLogo, brandName, previewImage, priceCents, productId, productName]);

  const handleAddToCart = () => {
    const line = createCpoCartLine({
      productId,
      productKey,
      productName,
      brandName: brandName || '',
      unitPriceCents: priceCents ?? 0,
      isReturnable,
      availabilityStatus: 'available',
      product: {
        ...productContext,
        basePrice: priceCents ?? 0,
        totalPrice: priceCents ?? 0,
      },
    });

    addLine(line);
    onAddToCart?.(line);
    setIsConfirmationOpen(true);
  };

  const handleCloseConfirmation = () => {
    setIsConfirmationOpen(false);
  };

  const handleGoToCart = () => {
    setIsConfirmationOpen(false);
    onGoToCart?.();
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
              text={isAlreadyInCart ? 'Produkt w koszyku' : 'Dodaj do koszyka'}
              variant="primary"
              iconUsed="arrowUp"
              onClick={handleAddToCart}
              disabled={isAlreadyInCart}
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
      <AddToCartConfirmationModal
        isOpen={isConfirmationOpen}
        product={{
          name: productContext.name,
          brandName: productContext.brandName,
          image: productContext.image,
          totalPrice: productContext.totalPrice,
        }}
        onClose={handleCloseConfirmation}
        onGoToCart={handleGoToCart}
      />
    </>
  );
}
