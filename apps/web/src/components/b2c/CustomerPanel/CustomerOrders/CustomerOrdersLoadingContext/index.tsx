'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type CustomerOrdersLoadingChangeType = 'pagination' | 'sort';

type CustomerOrdersLoadingContextType = {
  isPending: boolean;
  changeType: CustomerOrdersLoadingChangeType | null;
  startLoading: (type: CustomerOrdersLoadingChangeType) => void;
  clearLoading: () => void;
};

const CustomerOrdersLoadingContext =
  createContext<CustomerOrdersLoadingContextType>({
    isPending: false,
    changeType: null,
    startLoading: () => undefined,
    clearLoading: () => undefined,
  });

export function CustomerOrdersLoadingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isPending, setIsPending] = useState(false);
  const [changeType, setChangeType] =
    useState<CustomerOrdersLoadingChangeType | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const routeKey = `${pathname}?${paramsString}`;

  const clearLoading = useCallback(() => {
    setIsPending(false);
    setChangeType(null);
  }, []);

  useEffect(() => {
    clearLoading();
  }, [clearLoading, routeKey]);

  const startLoading = useCallback((type: CustomerOrdersLoadingChangeType) => {
    setIsPending(true);
    setChangeType(type);
  }, []);

  useEffect(() => {
    if (!isPending) return;

    const timeoutId = window.setTimeout(() => {
      clearLoading();
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [clearLoading, isPending]);

  const value = useMemo(
    () => ({ isPending, changeType, startLoading, clearLoading }),
    [isPending, changeType, startLoading, clearLoading],
  );

  return (
    <CustomerOrdersLoadingContext.Provider value={value}>
      {children}
    </CustomerOrdersLoadingContext.Provider>
  );
}

export function useCustomerOrdersLoading() {
  return useContext(CustomerOrdersLoadingContext);
}
