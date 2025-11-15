'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import PortableTextRenderer from '@/src/components/portableText';
import {
  type ComparisonProduct,
  processComparisonData,
} from '@/src/global/comparison';
import {
  addProductToComparison,
  removeProductFromComparison,
} from '@/src/global/comparison/cookie-manager';
import type { PortableTextProps } from '@/src/global/types';

import ConfirmationModal from '../../ui/ConfirmationModal';
import EmptyState from '../../ui/EmptyState';
import ComparisonProductCard from '../ComparisonProductCard';
import ProductSelector from '../ProductSelector';
import styles from './styles.module.scss';

type ComparisonTableProps = {
  products: ComparisonProduct[];
  availableProducts: ComparisonProduct[];
};

export default function ComparisonTable({
  products,
  availableProducts,
}: ComparisonTableProps) {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [productToRemove, setProductToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isStickyVisible, setIsStickyVisible] = useState(false);
  const productCardsRef = useRef<HTMLUListElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const comparisonWrapperRef = useRef<HTMLElement>(null);

  const allProducts = useMemo(
    () => [...products, ...availableProducts],
    [products, availableProducts]
  );

  const [comparisonIds, setComparisonIds] = useState<Set<string>>(
    () => new Set(products.map((p) => p._id))
  );

  const currentProducts = useMemo(
    () => allProducts.filter((p) => comparisonIds.has(p._id)),
    [allProducts, comparisonIds]
  );

  const currentAvailable = useMemo(
    () => allProducts.filter((p) => !comparisonIds.has(p._id)),
    [allProducts, comparisonIds]
  );

  const categorySlug =
    currentProducts[0]?.categories[0]?.slug ||
    allProducts[0]?.categories[0]?.slug ||
    '';

  const comparisonData = useMemo(
    () => processComparisonData(currentProducts),
    [currentProducts]
  );

  const handleRemove = (productId: string, productName: string) => {
    // If this is the last product, show confirmation modal
    if (comparisonIds.size === 1) {
      setProductToRemove({ id: productId, name: productName });
      setIsConfirmationOpen(true);
      return;
    }

    // Otherwise, remove directly
    setComparisonIds((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });

    toast.info(`${productName} usunięty z porównania`);
    removeProductFromComparison(productId);
  };

  const handleConfirmRemove = () => {
    if (!productToRemove) return;

    setComparisonIds((prev) => {
      const next = new Set(prev);
      next.delete(productToRemove.id);
      return next;
    });

    toast.info(`${productToRemove.name} usunięty z porównania`);
    removeProductFromComparison(productToRemove.id);
    setProductToRemove(null);
  };

  const handleOpenSelector = () => {
    if (!categorySlug) {
      toast.error('Nie można dodać produktu bez kategorii');
      return;
    }
    setIsSelectorOpen(true);
  };

  const handleProductSelect = (productId: string) => {
    const result = addProductToComparison(productId, categorySlug);
    if (result.success) {
      setComparisonIds((prev) => new Set([...prev, productId]));
      toast.success('Produkt dodany do porównania');
    } else {
      toast.error(result.error || 'Nie można dodać produktu');
    }
  };

  // IntersectionObserver for sticky header
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsStickyVisible(!entry.isIntersecting);
        }
      },
      {
        threshold: 0,
        rootMargin: '-75px 0px 0px 0px',
      }
    );

    const currentRef = productCardsRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  // Sync horizontal scroll between sticky header and main wrapper
  useEffect(() => {
    if (!isStickyVisible) return;

    const stickyHeader = stickyHeaderRef.current;
    const wrapper = comparisonWrapperRef.current;

    if (!stickyHeader || !wrapper) return;

    let isScrollingSticky = false;
    let isScrollingWrapper = false;

    const handleStickyScroll = () => {
      if (isScrollingWrapper) return;
      isScrollingSticky = true;
      wrapper.scrollLeft = stickyHeader.scrollLeft;
      requestAnimationFrame(() => {
        isScrollingSticky = false;
      });
    };

    const handleWrapperScroll = () => {
      if (isScrollingSticky) return;
      isScrollingWrapper = true;
      stickyHeader.scrollLeft = wrapper.scrollLeft;
      requestAnimationFrame(() => {
        isScrollingWrapper = false;
      });
    };

    stickyHeader.addEventListener('scroll', handleStickyScroll, {
      passive: true,
    });
    wrapper.addEventListener('scroll', handleWrapperScroll, { passive: true });

    // Sync initial scroll position
    stickyHeader.scrollLeft = wrapper.scrollLeft;

    return () => {
      stickyHeader.removeEventListener('scroll', handleStickyScroll);
      wrapper.removeEventListener('scroll', handleWrapperScroll);
    };
  }, [isStickyVisible]);

  const renderProductCards = (isSticky = false) => (
    <>
      {currentProducts.map((product, index) => (
        <ComparisonProductCard
          key={product._id}
          product={product}
          onRemove={handleRemove}
          index={index}
          isCompact={isSticky}
        />
      ))}
      {currentProducts.length < 3 &&
        Array.from({ length: 3 - currentProducts.length }).map((_, index) => (
          <li key={`placeholder-${index}`}>
            <button
              className={styles.placeholderCard}
              data-compact={isSticky}
              onClick={handleOpenSelector}
              type="button"
              aria-label="Dodaj produkt do porównania"
            >
              <div className={styles.placeholderIcon}>
                <PlusIcon />
              </div>
              {!isSticky && (
                <p className={styles.placeholderText}>Wybierz produkt</p>
              )}
            </button>
          </li>
        ))}
    </>
  );

  if (currentProducts.length === 0) {
    return (
      <section className={`${styles.emptyState} max-width`}>
        <EmptyState
          type="comparator-noProduct"
          button={{
            name: 'Przeglądaj produkty',
            href: '/produkty/',
          }}
        />
      </section>
    );
  }

  return (
    <>
      {isStickyVisible && (
        <div
          className={styles.stickyHeader}
          role="region"
          aria-label="Porównywane produkty"
        >
          <div className={styles.stickyContainer} ref={stickyHeaderRef}>
            <ul className={styles.stickyProductCards}>
              {renderProductCards(true)}
            </ul>
          </div>
        </div>
      )}

      <section
        ref={comparisonWrapperRef}
        className={`${styles.comparisonWrapper} max-width-block`}
      >
        <h1 className={styles.heading}>
          Porównujesz {currentProducts.length}{' '}
          {currentProducts.length === 1 ? 'produkt' : 'produkty'}
        </h1>
        <ul className={styles.productCards} ref={productCardsRef}>
          {renderProductCards()}
        </ul>

        {comparisonData.comparisonRows.length === 0 ? (
          <div className={styles.noData}>
            <p>Brak danych technicznych do porównania</p>
          </div>
        ) : (
          <>
            <h2 className={styles.heading}>Szczegóły produktu</h2>
            <table className={styles.comparisonTable} role="table">
              <tbody>
                {comparisonData.comparisonRows.map((row, rowIndex) => (
                  <tr
                    key={row.heading}
                    className={styles.dataRow}
                    data-row-index={rowIndex}
                  >
                    <td className={`${styles.headingCell} ${styles.heading}`}>
                      <span>{row.heading}</span>
                    </td>
                    {row.values.map((value, productIndex) => (
                      <td
                        key={`${currentProducts[productIndex]?._id}-${row.heading}`}
                        className={`${styles.dataCell} ${styles.value}`}
                      >
                        {value ? (
                          <PortableTextRenderer
                            value={value as PortableTextProps}
                            enablePortableTextStyles={false}
                          />
                        ) : (
                          <span className={styles.emptyValue}>---</span>
                        )}
                      </td>
                    ))}
                    {currentProducts.length < 3 &&
                      Array.from({ length: 3 - currentProducts.length }).map(
                        (_, index) => (
                          <td
                            key={`placeholder-${index}-${row.heading}`}
                            className={`${styles.dataCell} ${styles.value}`}
                          >
                            <span className={styles.emptyValue}>---</span>
                          </td>
                        )
                      )}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <ProductSelector
          isOpen={isSelectorOpen}
          onClose={() => setIsSelectorOpen(false)}
          availableProducts={currentAvailable}
          onProductSelect={handleProductSelect}
        />
        <ConfirmationModal
          isOpen={isConfirmationOpen}
          onClose={() => {
            setIsConfirmationOpen(false);
            setProductToRemove(null);
          }}
          onConfirm={handleConfirmRemove}
          title="Usunąć ostatni produkt?"
          message="Usunięcie tego produktu spowoduje wyczyszczenie całego porównania. Czy na pewno chcesz kontynuować?"
          confirmText="Usuń"
          cancelText="Anuluj"
        />
      </section>
    </>
  );
}

const PlusIcon = () => (
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
      d="M12 5v14M5 12h14"
    />
  </svg>
);
