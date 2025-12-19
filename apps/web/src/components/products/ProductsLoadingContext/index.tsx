'use client';

import { useSearchParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type LoadingChangeType = 'filter' | 'pagination' | 'sort';

type ProductsLoadingContextType = {
  /** True immediately when loading starts - use for optimistic UI updates */
  isPending: boolean;
  /** True after delay - use for showing skeleton (avoids flash on cached pages) */
  showSkeleton: boolean;
  /** Type of change that triggered loading - determines skeleton appearance */
  changeType: LoadingChangeType | null;
  /**
   * Start loading state with specified change type.
   * - 'filter': category, brand, price, search changes - hides top pagination
   * - 'pagination': page changes - shows top pagination
   * - 'sort': sorting changes - shows top pagination
   */
  startLoading: (type: LoadingChangeType) => void;
};

const ProductsLoadingContext = createContext<ProductsLoadingContextType>({
  isPending: false,
  showSkeleton: false,
  changeType: null,
  startLoading: () => {},
});

/**
 * Delay before showing skeleton (ms).
 * If navigation completes before this, no skeleton is shown (instant for cached pages).
 * If navigation takes longer, skeleton appears after this delay.
 */
const SKELETON_DELAY_MS = 100;

/**
 * Provider that manages loading state for products listing.
 *
 * Components call `startLoading(type)` when initiating a filter/navigation.
 * The loading state automatically clears when URL params change.
 *
 * Uses a delayed skeleton strategy:
 * - `isPending` is true immediately (for optimistic UI updates)
 * - `showSkeleton` becomes true after SKELETON_DELAY_MS (for actual skeleton rendering)
 * - If navigation completes before delay, skeleton never shows (cached pages = instant)
 */
export function ProductsLoadingProvider({ children }: { children: ReactNode }) {
  const [isPending, setIsPending] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [changeType, setChangeType] = useState<LoadingChangeType | null>(null);
  const searchParams = useSearchParams();
  const skeletonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the search params string to detect changes
  const paramsString = searchParams.toString();

  // When URL params change, loading is complete - clear all states
  useEffect(() => {
    // Clear the skeleton delay timeout if navigation completed before delay
    if (skeletonTimeoutRef.current) {
      clearTimeout(skeletonTimeoutRef.current);
      skeletonTimeoutRef.current = null;
    }
    setIsPending(false);
    setShowSkeleton(false);
    setChangeType(null);
  }, [paramsString]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (skeletonTimeoutRef.current) {
        clearTimeout(skeletonTimeoutRef.current);
      }
    };
  }, []);

  const startLoading = useCallback((type: LoadingChangeType) => {
    // Set isPending immediately for optimistic UI updates (filter counts, etc.)
    setIsPending(true);
    setChangeType(type);

    // Clear any existing timeout
    if (skeletonTimeoutRef.current) {
      clearTimeout(skeletonTimeoutRef.current);
    }

    // Delay showing the skeleton - if navigation completes before this, no skeleton flash
    skeletonTimeoutRef.current = setTimeout(() => {
      setShowSkeleton(true);
      skeletonTimeoutRef.current = null;
    }, SKELETON_DELAY_MS);
  }, []);

  const value = useMemo(
    () => ({ isPending, showSkeleton, changeType, startLoading }),
    [isPending, showSkeleton, changeType, startLoading],
  );

  return (
    <ProductsLoadingContext.Provider value={value}>
      {children}
    </ProductsLoadingContext.Provider>
  );
}

/**
 * Hook to access the products loading state.
 * Call `startLoading(type)` before navigation to show the skeleton overlay.
 */
export function useProductsLoading() {
  return useContext(ProductsLoadingContext);
}
