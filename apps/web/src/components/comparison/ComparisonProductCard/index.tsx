'use client';

import Link from 'next/link';

import Image from '@/src/components/shared/Image';
import type { ComparisonProduct } from '@/src/global/comparison/types';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

type ComparisonProductCardProps = {
  product: ComparisonProduct;
  onRemove: (productId: string, productName: string) => void;
  index: number;
  isCompact?: boolean;
};

export default function ComparisonProductCard({
  product,
  onRemove,
  index,
  isCompact = false,
}: ComparisonProductCardProps) {
  const productSlug =
    typeof product.slug === 'string'
      ? product.slug
      : (product.slug as unknown as { current?: string })?.current ||
        product._id;

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(product._id, product.name);
  };

  const sizes = isCompact
    ? '(max-width: 37.5rem) 48px, 68px'
    : '(max-width: 38.75rem) 160px, (max-width: 50rem) 24vw, (max-width: 75rem) 240px, 280px';

  return (
    <li className={styles.productCard} data-compact={isCompact}>
      <button
        className={styles.removeButton}
        onClick={handleRemove}
        type="button"
      >
        <RemoveIcon />
        {!isCompact && <span className={styles.removeText}>Usuń produkt</span>}
      </button>
      <Link href={productSlug} className={styles.productLink}>
        <div className={styles.imageWrapper}>
          {product.mainImage ? (
            <Image
              image={product.mainImage}
              sizes={sizes}
              fill
              className={
                product.imageSource === 'preview'
                  ? styles.productImageContain
                  : styles.productImageCover
              }
              loading={isCompact ? 'lazy' : 'eager'}
              fetchPriority={!isCompact && index === 0 ? 'high' : 'auto'}
            />
          ) : (
            <div className={styles.imagePlaceholder} />
          )}
        </div>
        <div className={styles.info}>
          {product.brand?.name && (
            <p className={styles.brandName}>{product.brand.name}</p>
          )}
          <h3 className={styles.productName}>{product.name}</h3>
          {!isCompact && product.subtitle && (
            <p className={styles.subtitle}>{product.subtitle}</p>
          )}
          {product.basePriceCents !== null &&
            product.basePriceCents !== undefined && (
              <p className={styles.price}>
                {formatPrice(product.basePriceCents)}/sztuka
              </p>
            )}
        </div>
      </Link>
    </li>
  );
}

const RemoveIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={16}
    height={16}
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);
