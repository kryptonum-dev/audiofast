'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  addProductToComparison,
  isProductInComparison,
  removeProductFromComparison,
} from '@/src/global/comparison/cookie-manager';

import styles from './styles.module.scss';

type AddToComparisonButtonProps = {
  productId: string;
  productName: string;
  categorySlug?: string;
  categoryName?: string;
  productData?: unknown; // Full product data for optimistic updates
};

export default function AddToComparisonButton({
  productId,
  productName,
  categorySlug,
  categoryName,
  productData,
}: AddToComparisonButtonProps) {
  const [isInComparison, setIsInComparison] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Check if product is already in comparison on mount and listen for changes
  useEffect(() => {
    const checkComparison = () => {
      setIsInComparison(isProductInComparison(productId));
    };

    checkComparison();

    // Listen for comparison changes from other components
    window.addEventListener('audiofast:comparison-changed', checkComparison);

    return () => {
      window.removeEventListener(
        'audiofast:comparison-changed',
        checkComparison,
      );
    };
  }, [productId]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // If already in comparison, remove it
    if (isInComparison) {
      removeProductFromComparison(productId);
      setIsInComparison(false);
      setShowFeedback(false);
      toast.info('Produkt usunięty z porównania');
      return;
    }

    // Otherwise, add to comparison
    if (!categorySlug) {
      toast.error('Nie można dodać produktu bez kategorii');
      return;
    }

    const result = addProductToComparison(productId, categorySlug, {
      categoryName,
      productName,
      productData,
    });

    if (result.success) {
      setIsInComparison(true);
      setShowFeedback(true);
      toast.success('Produkt dodany do porównania');

      // Hide feedback after 2 seconds
      setTimeout(() => {
        setShowFeedback(false);
      }, 2000);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <button
      className={styles.addToComparison}
      onClick={handleClick}
      data-current-state={
        showFeedback ? 'added' : isInComparison ? 'in-comparison' : 'default'
      }
      aria-label={
        isInComparison
          ? `Usuń ${productName} z porównania`
          : `Dodaj ${productName} do porównania`
      }
    >
      <span>
        {showFeedback
          ? 'Dodano!'
          : isInComparison
            ? 'Usuń z porównania'
            : 'Dodaj do porównania'}
      </span>
      {showFeedback ? (
        <CheckmarkIcon />
      ) : isInComparison ? (
        <RemoveIcon />
      ) : (
        <PlusIcon />
      )}
    </button>
  );
}

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={25} fill="none">
    <g
      stroke="#FE0140"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.875}
      clipPath="url(#a)"
    >
      <path d="M9 12.5h6M12 9.5v6M12 3.5c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 .5h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);

const CheckmarkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={25} fill="none">
    <g
      stroke="#009116"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.875}
      clipPath="url(#b)"
    >
      <path d="m7 12.5 3 3 7-7M12 3.5c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9Z" />
    </g>
    <defs>
      <clipPath id="b">
        <path fill="#fff" d="M0 .5h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);

const RemoveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={25} fill="none">
    <g
      stroke="#FE0140"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.875}
      clipPath="url(#c)"
    >
      <path d="m15 9.5-6 6m0-6 6 6M12 3.5c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9Z" />
    </g>
    <defs>
      <clipPath id="c">
        <path fill="#fff" d="M0 .5h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
