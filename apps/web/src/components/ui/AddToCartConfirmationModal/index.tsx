'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import type { SanityRawImage } from '@/components/shared/Image';
import Image from '@/components/shared/Image';
import { formatPrice } from '@/src/global/utils';

import Button from '../Button';
import styles from './styles.module.scss';

type AddToCartConfirmationProduct = {
  name: string;
  brandName: string;
  image: SanityRawImage;
  totalPrice: number | null;
};

type AddToCartConfirmationModalProps = {
  isOpen: boolean;
  product: AddToCartConfirmationProduct;
  onClose: () => void;
  onGoToCart: () => void;
};

export default function AddToCartConfirmationModal({
  isOpen,
  product,
  onClose,
  onGoToCart,
}: AddToCartConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formattedPrice =
    typeof product.totalPrice === 'number' && product.totalPrice > 0
      ? formatPrice(product.totalPrice)
      : null;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-cart-confirmation-title"
    >
      <div
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Zamknij potwierdzenie"
        >
          <CloseIcon />
        </button>

        <span className={styles.eyebrow}>Dodano do koszyka</span>
        <h2 id="add-to-cart-confirmation-title" className={styles.title}>
          Produkt został dodany
        </h2>

        <div className={styles.productCard}>
          <div className={styles.productImage}>
            <Image image={product.image} sizes="96px" alt="" />
          </div>
          <div className={styles.productInfo}>
            <span className={styles.productBrand}>{product.brandName}</span>
            <span className={styles.productName}>{product.name}</span>
            {formattedPrice ? (
              <span className={styles.productPrice}>{formattedPrice}</span>
            ) : null}
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            iconUsed="arrowLeft"
            onClick={onClose}
            className={styles.actionButton}
          >
            Kontynuuj zakupy
          </Button>
          <Button
            type="button"
            variant="primary"
            iconUsed="arrowUp"
            onClick={onGoToCart}
            className={styles.actionButton}
          >
            Przejdź do koszyka
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M18 6L6 18M6 6l12 12"
    />
  </svg>
);
