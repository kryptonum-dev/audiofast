"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import PortableTextRenderer from "@/src/components/portableText";
import {
  type ComparisonProduct,
  type EnabledParameter,
  getProductColumnCount,
  getProductVariants,
  processComparisonData,
} from "@/src/global/comparison";
import {
  addProductToComparison,
  removeProductFromComparison,
} from "@/src/global/comparison/cookie-manager";
import type { PortableTextProps } from "@/src/global/types";

import ConfirmationModal from "../../ui/ConfirmationModal";
import EmptyState from "../../ui/EmptyState";
import ComparisonProductCard from "../ComparisonProductCard";
import ProductSelector from "../ProductSelector";
import styles from "./styles.module.scss";

type ComparisonTableProps = {
  products: ComparisonProduct[];
  availableProducts: ComparisonProduct[];
  enabledParameters?: EnabledParameter[];
};

export default function ComparisonTable({
  products,
  availableProducts,
  enabledParameters,
}: ComparisonTableProps) {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [productToRemove, setProductToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isStickyVisible, setIsStickyVisible] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const productCardsRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const comparisonWrapperRef = useRef<HTMLElement>(null);
  const customScrollbarRef = useRef<HTMLDivElement>(null);

  const allProducts = useMemo(
    () => [...products, ...availableProducts],
    [products, availableProducts],
  );

  const [comparisonIds, setComparisonIds] = useState<Set<string>>(
    () => new Set(products.map((p) => p._id)),
  );

  const currentProducts = useMemo(
    () => allProducts.filter((p) => comparisonIds.has(p._id)),
    [allProducts, comparisonIds],
  );

  const currentAvailable = useMemo(
    () => allProducts.filter((p) => !comparisonIds.has(p._id)),
    [allProducts, comparisonIds],
  );

  const categorySlug =
    currentProducts[0]?.categories[0]?.slug ||
    allProducts[0]?.categories[0]?.slug ||
    "";
  const categoryName =
    currentProducts[0]?.categories[0]?.name ||
    allProducts[0]?.categories[0]?.name ||
    "";

  // Process comparison data with new structure
  const comparisonData = useMemo(
    () => processComparisonData(currentProducts, enabledParameters),
    [currentProducts, enabledParameters],
  );

  // Check if any product has variants
  const hasAnyVariants = useMemo(
    () => currentProducts.some((p) => getProductVariants(p) !== null),
    [currentProducts],
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
      toast.error("Nie można dodać produktu bez kategorii");
      return;
    }
    setIsSelectorOpen(true);
  };

  const handleProductSelect = (productId: string) => {
    const selectedProduct = allProducts.find(
      (product) => product._id === productId,
    );
    const result = addProductToComparison(productId, categorySlug, {
      categoryName,
      productName: selectedProduct?.name,
    });
    if (result.success) {
      setComparisonIds((prev) => new Set([...prev, productId]));
      toast.success("Produkt dodany do porównania");
    } else {
      toast.error(result.error || "Nie można dodać produktu");
    }
  };

  // Check vertical scroll position for sticky header (ignore horizontal scroll)
  useEffect(() => {
    const checkStickyVisibility = () => {
      const productCards = productCardsRef.current;
      if (!productCards) return;

      // Get the vertical position of product cards relative to viewport
      const rect = productCards.getBoundingClientRect();
      // Show sticky header when product cards are scrolled above the viewport
      // Account for header height (~75px)
      const shouldBeSticky = rect.bottom < 75;
      setIsStickyVisible(shouldBeSticky);
    };

    // Check on scroll (vertical page scroll)
    window.addEventListener("scroll", checkStickyVisibility, { passive: true });

    // Initial check
    checkStickyVisibility();

    return () => {
      window.removeEventListener("scroll", checkStickyVisibility);
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

    stickyHeader.addEventListener("scroll", handleStickyScroll, {
      passive: true,
    });
    wrapper.addEventListener("scroll", handleWrapperScroll, { passive: true });

    // Sync initial scroll position
    stickyHeader.scrollLeft = wrapper.scrollLeft;

    return () => {
      stickyHeader.removeEventListener("scroll", handleStickyScroll);
      wrapper.removeEventListener("scroll", handleWrapperScroll);
    };
  }, [isStickyVisible]);

  // Check if content is scrollable
  useEffect(() => {
    const wrapper = comparisonWrapperRef.current;
    if (!wrapper) return;

    const checkScrollable = () => {
      setIsScrollable(wrapper.scrollWidth > wrapper.clientWidth);
    };

    checkScrollable();

    // Update on resize
    const resizeObserver = new ResizeObserver(checkScrollable);
    resizeObserver.observe(wrapper);

    return () => {
      resizeObserver.disconnect();
    };
  }, [currentProducts]);

  // Sync custom scrollbar with main wrapper and match content width
  useEffect(() => {
    if (!isScrollable) return;

    const wrapper = comparisonWrapperRef.current;
    const scrollbar = customScrollbarRef.current;

    if (!wrapper || !scrollbar) return;

    // Get the scrollbar content element
    const scrollbarContent = scrollbar.querySelector(
      `.${styles.scrollbarContent}`,
    ) as HTMLElement;

    // Update scrollbar content width
    const updateScrollbarWidth = () => {
      if (!scrollbarContent) return;
      const ratio = wrapper.scrollWidth / wrapper.clientWidth;
      scrollbarContent.style.width = `${ratio * 100}%`;
    };

    updateScrollbarWidth();

    let isScrollingScrollbar = false;
    let isScrollingWrapper = false;

    const handleScrollbarScroll = () => {
      if (isScrollingWrapper) return;
      isScrollingScrollbar = true;
      // Calculate proportional scroll position
      const ratio = wrapper.scrollWidth / scrollbar.scrollWidth;
      wrapper.scrollLeft = scrollbar.scrollLeft * ratio;
      requestAnimationFrame(() => {
        isScrollingScrollbar = false;
      });
    };

    const handleWrapperScroll = () => {
      if (isScrollingScrollbar) return;
      isScrollingWrapper = true;
      // Calculate proportional scroll position
      const ratio = scrollbar.scrollWidth / wrapper.scrollWidth;
      scrollbar.scrollLeft = wrapper.scrollLeft * ratio;
      requestAnimationFrame(() => {
        isScrollingWrapper = false;
      });
    };

    scrollbar.addEventListener("scroll", handleScrollbarScroll, {
      passive: true,
    });
    wrapper.addEventListener("scroll", handleWrapperScroll, { passive: true });

    // Update on resize
    const resizeObserver = new ResizeObserver(updateScrollbarWidth);
    resizeObserver.observe(wrapper);

    return () => {
      scrollbar.removeEventListener("scroll", handleScrollbarScroll);
      wrapper.removeEventListener("scroll", handleWrapperScroll);
      resizeObserver.disconnect();
    };
  }, [isScrollable, currentProducts]);

  // Calculate placeholder count (always show 3 cards total)
  const placeholderCount = Math.max(0, 3 - currentProducts.length);

  // Render product cards
  const renderProductCards = (isSticky = false) => (
    <>
      {currentProducts.map((product, index) => {
        const columnCount = getProductColumnCount(product);
        return (
          <ComparisonProductCard
            key={product._id}
            product={product}
            onRemove={handleRemove}
            index={index}
            isCompact={isSticky}
            columnSpan={columnCount}
          />
        );
      })}
      {/* Render placeholder cards to always have 3 total */}
      {Array.from({ length: placeholderCount }).map((_, index) => (
        <div
          key={`placeholder-card-${index}`}
          className={styles.placeholderCard}
          data-compact={isSticky}
          onClick={handleOpenSelector}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleOpenSelector()}
          aria-label="Dodaj produkt do porównania"
        >
          <div className={styles.placeholderIcon}>
            <PlusIcon />
          </div>
          {!isSticky && (
            <p className={styles.placeholderText}>Wybierz produkt</p>
          )}
        </div>
      ))}
    </>
  );

  // Render variant names row (only if any product has variants)
  const renderVariantRow = () => {
    if (!hasAnyVariants) return null;

    return (
      <div className={styles.variantRow}>
        {currentProducts.map((product) => {
          const variants = getProductVariants(product);
          if (variants) {
            return variants.map((variantName, idx) => (
              <div
                key={`${product._id}-variant-${idx}`}
                className={styles.variantCell}
                data-is-variant="true"
              >
                {variantName}
              </div>
            ));
          }
          // Single-model product - empty cell (wider)
          return (
            <div
              key={`${product._id}-single`}
              className={styles.variantCell}
              data-is-variant="false"
            />
          );
        })}
        {/* Placeholder cells */}
        {Array.from({ length: placeholderCount }).map((_, index) => (
          <div
            key={`placeholder-variant-${index}`}
            className={styles.variantCell}
            data-is-variant="false"
            data-is-placeholder="true"
          />
        ))}
      </div>
    );
  };

  if (currentProducts.length === 0) {
    return (
      <section className={`${styles.emptyState} max-width`}>
        <EmptyState
          type="comparator-noProduct"
          button={{
            name: "Przeglądaj produkty",
            href: "/produkty/",
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
            <div className={styles.stickyProductCards}>
              {renderProductCards(true)}
            </div>
          </div>
        </div>
      )}

      <section
        ref={comparisonWrapperRef}
        className={`${styles.comparisonWrapper} max-width-block`}
      >
        <div className={styles.headingRow}>
          <h1>
            Porównujesz {currentProducts.length}{" "}
            {currentProducts.length === 1 ? "produkt" : "produkty"}
          </h1>
          {/* Custom scrollbar - only show if content overflows */}
          {isScrollable && (
            <div
              ref={customScrollbarRef}
              className={styles.customScrollbar}
              aria-hidden="true"
            >
              <div className={styles.scrollbarContent} />
            </div>
          )}
        </div>

        {/* Product cards header */}
        <div className={styles.productCards} ref={productCardsRef}>
          {renderProductCards()}
        </div>

        {/* Variant names row (if any product has variants) */}
        {renderVariantRow()}

        {comparisonData.comparisonRows.length === 0 ? (
          <div className={styles.noData}>
            <p>Brak danych technicznych do porównania</p>
          </div>
        ) : (
          <>
            <h2 className={styles.heading}>Szczegóły produktu</h2>
            <div className={styles.parametersGrid}>
              {comparisonData.comparisonRows.map((row, rowIndex) => (
                <div
                  key={row.heading}
                  className={styles.parameterBlock}
                  data-row-index={rowIndex}
                >
                  {/* Parameter name row */}
                  <div className={styles.parameterName}>
                    {row.displayHeading}
                  </div>
                  {/* Values row */}
                  <div className={styles.valuesRow}>
                    {row.values.map((value, columnIndex) => {
                      const column = comparisonData.columns[columnIndex];
                      return (
                        <div
                          key={`${column?.productId}-${column?.variantIndex}-${row.heading}`}
                          className={styles.valueCell}
                          data-is-variant={column?.variantName !== null}
                        >
                          {value ? (
                            <PortableTextRenderer
                              value={value as PortableTextProps}
                              enablePortableTextStyles={false}
                            />
                          ) : (
                            <span className={styles.emptyValue}>---</span>
                          )}
                        </div>
                      );
                    })}
                    {/* Placeholder cells */}
                    {Array.from({ length: placeholderCount }).map(
                      (_, index) => (
                        <div
                          key={`placeholder-value-${row.heading}-${index}`}
                          className={styles.valueCell}
                          data-is-variant="false"
                          data-is-placeholder="true"
                        >
                          <span className={styles.emptyValue}>---</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
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
