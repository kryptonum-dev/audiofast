"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useOptimistic, useState } from "react";
import { toast } from "sonner";

import { fetchComparisonProducts } from "@/src/app/actions/comparison";
import Image from "@/src/components/shared/Image";
import {
  clearComparison,
  getComparisonCookie,
  removeProductFromComparison,
} from "@/src/global/comparison/cookie-manager";
import type { ProductType } from "@/src/global/types";

import styles from "./styles.module.scss";

export default function FloatingComparisonBox() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // Optimistic state for instant UI updates
  const [optimisticProducts, removeOptimisticProduct] = useOptimistic<
    ProductType[],
    string
  >(products, (state, productIdToRemove) =>
    state.filter((product) => product._id !== productIdToRemove),
  );

  // Load products from cookie and fetch data
  const loadProducts = async () => {
    const cookie = getComparisonCookie();

    if (!cookie || cookie.productIds.length === 0) {
      setProducts([]);
      setHasInitiallyLoaded(true);
      return;
    }

    try {
      const fetchedProducts = await fetchComparisonProducts(cookie.productIds);
      if (fetchedProducts) {
        setProducts(fetchedProducts);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Error loading comparison products:", error);
      setProducts([]);
    } finally {
      setHasInitiallyLoaded(true);
    }
  };

  // Set body attribute when comparator is visible (for sticky nav positioning)
  useEffect(() => {
    // Don't set attribute if we're on the comparison page
    if (pathname === "/porownaj") {
      document.body.removeAttribute("data-comparison-visible");
      return;
    }

    if (hasInitiallyLoaded && optimisticProducts.length > 0) {
      document.body.setAttribute("data-comparison-visible", "true");
    } else {
      document.body.removeAttribute("data-comparison-visible");
    }

    return () => {
      document.body.removeAttribute("data-comparison-visible");
    };
  }, [hasInitiallyLoaded, optimisticProducts.length, pathname]);

  // Load products on mount and when cookie changes
  useEffect(() => {
    loadProducts();

    // Listen for custom comparison change events
    // This fires when products are added/removed from any component
    const handleComparisonChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const productData = customEvent.detail?.productData;

      // If we have product data, add it optimistically for instant display
      if (productData) {
        startTransition(() => {
          setProducts((prev) => {
            // Check if product already exists to avoid duplicates
            const productId =
              (productData as { _id?: string })._id ||
              (productData as { productId?: string }).productId;

            if (productId && prev.some((p) => p._id === productId)) {
              return prev;
            }

            // Add the new product optimistically
            return [...prev, productData as ProductType];
          });
        });
      }

      // Still load in background to sync from cookie
      loadProducts();
    };

    window.addEventListener(
      "audiofast:comparison-changed",
      handleComparisonChange,
    );

    // Also listen for storage events (cookie changes from other tabs/windows)
    const handleStorageChange = () => {
      loadProducts();
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(
        "audiofast:comparison-changed",
        handleComparisonChange,
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const handleRemove = async (productId: string, productName: string) => {
    // Optimistically remove the product from UI immediately (wrapped in transition)
    startTransition(() => {
      removeOptimisticProduct(productId);
    });

    toast.info(`${productName} usunięty z porównania`);

    // Then perform the actual removal in the background
    removeProductFromComparison(productId);

    // Reload without showing loading state (transition handles it)
    const cookie = getComparisonCookie();
    if (!cookie || cookie.productIds.length === 0) {
      setProducts([]);
      return;
    }

    try {
      const fetchedProducts = await fetchComparisonProducts(cookie.productIds);
      if (fetchedProducts) {
        setProducts(fetchedProducts);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Error loading comparison products:", error);
      setProducts([]);
    }
  };

  const handleClear = async () => {
    // Clear immediately (no optimistic state needed as we're closing the box)
    clearComparison();
    toast.info("Porównanie wyczyszczone");
    setIsOpen(false);
    await loadProducts();
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  // Don't render until initial load is complete
  if (!hasInitiallyLoaded) {
    return null;
  }

  // Don't render on the comparison page
  if (pathname === "/porownaj/" || pathname === "/porownaj") {
    return null;
  }

  // Don't render if no products (use optimistic state for instant feedback)
  if (optimisticProducts.length === 0) {
    return null;
  }

  const count = optimisticProducts.length;
  // Read category name from the cookie (stored when first product was added)
  // Fall back to product category data for older cookies that don't have categoryName
  const cookie = getComparisonCookie();
  const productCategory = optimisticProducts[0]?.categories?.[0] as
    | { slug?: string; name?: string }
    | undefined;
  const currentCategoryLabel =
    cookie?.categoryName || productCategory?.name || null;

  return (
    <div
      className={`${styles.floatingBox} ${isOpen ? styles.expanded : styles.collapsed}`}
      role="region"
      aria-label="Porównywarka produktów"
    >
      {isOpen ? (
        <>
          <div className={styles.header}>
            <h3 className={styles.title}>Porównywarka ({count})</h3>
            <button
              className={styles.closeButton}
              onClick={handleToggle}
              aria-label="Zamknij porównywarkę"
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
          {currentCategoryLabel && (
            <p className={styles.categoryHint}>
              Aktualnie porównujesz produkty z kategorii{" "}
              <strong>{currentCategoryLabel}</strong>.
            </p>
          )}
          <ul className={styles.productList}>
            {optimisticProducts.map((product) => {
              const productSlug =
                typeof product.slug === "string"
                  ? product.slug
                  : (product.slug as unknown as { current?: string })
                      ?.current || product._id;

              return (
                <li key={product._id} className={styles.productItem}>
                  <Link
                    href={productSlug}
                    className={styles.productLink}
                    onClick={() => setIsOpen(false)}
                  >
                    {product.mainImage && (
                      <Image
                        className={styles.productImage}
                        image={product.mainImage}
                        sizes="160px"
                        loading="lazy"
                      />
                    )}
                    <span className={styles.productInfo}>
                      {product.brand?.name} {product.name}
                    </span>
                  </Link>
                  <button
                    className={styles.removeButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(product._id, product.name ?? "");
                    }}
                    aria-label={`Usuń ${product.name} z porównania`}
                    type="button"
                  >
                    <RemoveIcon />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className={styles.actions}>
            <Link
              href="/porownaj"
              className={styles.compareButton}
              onClick={() => setIsOpen(false)}
            >
              Porównaj
            </Link>
            <button
              className={styles.clearButton}
              onClick={handleClear}
              type="button"
            >
              Wyczyść
            </button>
          </div>
        </>
      ) : (
        <button
          className={styles.collapsedButton}
          onClick={handleToggle}
          aria-label={`Otwórz porównywarkę (${count} produktów)`}
          type="button"
        >
          <span className={styles.collapsedText}>Porównaj ({count})</span>
          <span className={styles.compareIconContainer}>
            <CompareIcon />
          </span>
        </button>
      )}
    </div>
  );
}

const CompareIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={18}
    height={18}
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 3v18M16 3v18M3 8h18M3 16h18"
    />
  </svg>
);

const CloseIcon = () => (
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
      d="M18 6L6 18M6 6l12 12"
    />
  </svg>
);

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
      d="M18 6L6 18M6 6l12 12"
    />
  </svg>
);
