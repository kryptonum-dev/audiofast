'use client';

import { useSearchParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type LoadingChangeType = 'filter' | 'pagination' | 'sort';

type ProductsLoadingContextType = {
  isPending: boolean;
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
  changeType: null,
  startLoading: () => {},
});

/**
 * Provider that manages loading state for products listing.
 *
 * Components call `startLoading(type)` when initiating a filter/navigation.
 * The loading state automatically clears when URL params change.
 */
export function ProductsLoadingProvider({ children }: { children: ReactNode }) {
  const [isPending, setIsPending] = useState(false);
  const [changeType, setChangeType] = useState<LoadingChangeType | null>(null);
  const searchParams = useSearchParams();

  // Track the search params string to detect changes
  const paramsString = searchParams.toString();

  // When URL params change, loading is complete
  useEffect(() => {
    setIsPending(false);
    setChangeType(null);
  }, [paramsString]);

  const startLoading = useCallback((type: LoadingChangeType) => {
    setIsPending(true);
    setChangeType(type);
  }, []);

  const value = useMemo(
    () => ({ isPending, changeType, startLoading }),
    [isPending, changeType, startLoading],
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
