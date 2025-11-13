'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  addProductToComparison,
  isProductInComparison,
  removeProductFromComparison,
} from '@/src/global/comparison/cookie-manager';

import styles from './styles.module.scss';

type AddToComparisonProps = {
  productId?: string;
  categorySlug?: string;
  productName?: string;
  productData?: unknown; // Partial or full product data for optimistic updates
};

export default function AddToComparison({
  productId,
  categorySlug,
  productName,
  productData,
}: AddToComparisonProps) {
  const [isInComparison, setIsInComparison] = useState(false);

  // Check if product is already in comparison on mount and listen for changes
  useEffect(() => {
    if (!productId) return;

    const checkComparison = () => {
      setIsInComparison(isProductInComparison(productId));
    };

    checkComparison();

    // Listen for comparison changes from other components
    window.addEventListener('audiofast:comparison-changed', checkComparison);

    return () => {
      window.removeEventListener(
        'audiofast:comparison-changed',
        checkComparison
      );
    };
  }, [productId]);

  const handleClick = () => {
    if (!productId || !categorySlug) {
      toast.error('Nie można dodać produktu bez kategorii');
      return;
    }

    // If already in comparison, remove it
    if (isInComparison) {
      removeProductFromComparison(productId);
      setIsInComparison(false);
      toast.info('Produkt usunięty z porównania');
      return;
    }

    // Otherwise, add to comparison
    const result = addProductToComparison(productId, categorySlug, productData);

    if (result.success) {
      setIsInComparison(true);
      toast.success('Produkt dodany do porównania');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <button
      className={styles.addToComparison}
      onClick={handleClick}
      data-in-comparison={isInComparison}
      type="button"
      aria-label={
        isInComparison
          ? `Usuń ${productName || 'produkt'} z porównania`
          : `Dodaj ${productName || 'produkt'} do porównania`
      }
    >
      <span className={styles.iconWrapper}>
        {isInComparison ? (
          <MinusIcon className={styles.minusIcon} />
        ) : (
          <PlusIcon className={styles.plusIcon} />
        )}
      </span>
      <span className={styles.addToComparisonText}>
        {isInComparison ? 'Usuń z porównania' : 'Dodaj do porównania'}
      </span>
    </button>
  );
}

const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const MinusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
  </svg>
);
