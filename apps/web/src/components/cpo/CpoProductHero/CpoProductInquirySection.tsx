'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import ProductInquiryModal, {
  type ProductContext,
} from '@/src/components/products/ProductInquiryModal';
import type { SanityRawImage } from '@/src/components/shared/Image';
import AddToCartConfirmationModal from '@/src/components/ui/AddToCartConfirmationModal';
import Button from '@/src/components/ui/Button';
import type { FormStateData } from '@/src/components/ui/FormStates';
import { trackAddToCart } from '@/src/global/b2c/analytics/commerce-events';
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
}: CpoProductInquirySectionProps) {
  const { addLine, removeLine, cart } = useCart();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const isConfirmationOpenRef = useRef(isConfirmationOpen);
  const shouldCloseConfirmationOnRestoreRef = useRef(false);
  const formattedPrice =
    typeof priceCents === 'number' && priceCents > 0
      ? formatPrice(priceCents)
      : 'Cena do ustalenia';
  const existingCpoLine = cart.lines.find(
    (line) => line.lineType === 'cpo' && line.productKey === productKey,
  );
  const isAlreadyInCart = !!existingCpoLine;

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

  const handleToggleCart = () => {
    if (existingCpoLine) {
      removeLine(existingCpoLine.lineId);
      setIsConfirmationOpen(false);
      toast.info(`${productName} usunięty z koszyka`);

      return;
    }

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
    trackAddToCart(line);
    onAddToCart?.(line);
    setIsConfirmationOpen(true);
  };

  const handleCloseConfirmation = () => {
    setIsConfirmationOpen(false);
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
              text={isAlreadyInCart ? 'Usuń z koszyka' : 'Dodaj do koszyka'}
              variant="primary"
              iconUsed={isAlreadyInCart ? 'removeFromCart' : 'addToCart'}
              onClick={handleToggleCart}
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
      />
    </>
  );
}
