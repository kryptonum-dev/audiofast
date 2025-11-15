'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import Image from '@/src/components/shared/Image';
import type { ComparisonProduct } from '@/src/global/comparison/types';

import styles from './styles.module.scss';

type ProductSelectorProps = {
  isOpen: boolean;
  onClose: () => void;
  availableProducts: ComparisonProduct[];
  onProductSelect: (productId: string) => void;
};

// Helper function to normalize text for searching (remove diacritics, lowercase)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export default function ProductSelector({
  isOpen,
  onClose,
  availableProducts,
  onProductSelect,
}: ProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Instant client-side filtering (no async, no debounce!)
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableProducts;
    }

    const normalizedQuery = normalizeText(searchQuery);
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

    return availableProducts.filter((product) => {
      const searchableText = normalizeText(
        `${product.name} ${product.brand.name} ${product.subtitle || ''}`
      );

      // Match if ALL query words are found in the searchable text
      return queryWords.every((word) => searchableText.includes(word));
    });
  }, [searchQuery, availableProducts]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  const handleProductClick = (productId: string) => {
    onProductSelect(productId);
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} ref={modalRef}>
        <header className={styles.header}>
          <h2 className={styles.title}>Dodaj produkt do porównania</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
            aria-label="Zamknij selektor produktów"
          >
            <CloseIcon />
          </button>
        </header>

        <div className={styles.searchWrapper}>
          <SearchIcon />
          <input
            ref={searchInputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Szukaj produktu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Szukaj produktu"
          />
        </div>
        {filteredProducts.length > 0 ? (
          <ul className={styles.productList}>
            {filteredProducts.map((product) => {
              const imageClassName =
                product.imageSource === 'preview'
                  ? styles.productImageContain
                  : styles.productImageCover;

              return (
                <li key={product._id}>
                  <button
                    className={styles.productButton}
                    onClick={() => handleProductClick(product._id)}
                    type="button"
                  >
                    <div className={styles.productImageWrapper}>
                      <Image
                        image={product.mainImage}
                        sizes="(max-width: 37.5rem) 68px, 80px"
                        loading="lazy"
                        className={imageClassName}
                      />
                    </div>
                    <div className={styles.productInfo}>
                      <span className={styles.productName}>{product.name}</span>
                      <span className={styles.brandName}>
                        {product.brand.name}
                      </span>
                    </div>
                    <div className={styles.addIcon}>
                      <PlusIcon />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <AlertIcon />
            </div>
            <p className={styles.emptyTitle}>
              {searchQuery
                ? 'Nie znaleziono produktów'
                : 'Brak dostępnych produktów'}
            </p>
          </div>
        )}
      </div>
    </div>
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

const SearchIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 5v14m-7-7h14"
    />
  </svg>
);

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#a)"
    >
      <path d="M9.996 20.777a8.94 8.94 0 0 1-2.48-.97M14 3.223a9.003 9.003 0 0 1 0 17.554M4.579 17.093a8.963 8.963 0 0 1-1.227-2.592M3.125 10.5c.16-.95.468-1.85.9-2.675l.169-.305M6.906 4.579A8.954 8.954 0 0 1 10 3.223M12 8v4M12 16v.01" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
