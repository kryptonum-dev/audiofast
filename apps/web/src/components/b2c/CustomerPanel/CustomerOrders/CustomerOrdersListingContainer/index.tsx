'use client';

import { type ReactNode, useEffect } from 'react';

import CustomerOrdersListingSkeleton from '../CustomerOrdersListingSkeleton';
import { useCustomerOrdersLoading } from '../CustomerOrdersLoadingContext';
import styles from './styles.module.scss';

type CustomerOrdersListingContainerProps = {
  children: ReactNode;
  visibleItemCount: number;
  listingSignature: string;
};

export default function CustomerOrdersListingContainer({
  children,
  listingSignature,
  visibleItemCount,
}: CustomerOrdersListingContainerProps) {
  const { clearLoading, isPending } = useCustomerOrdersLoading();
  const skeletonItemCount = Math.max(1, Math.min(8, visibleItemCount));

  useEffect(() => {
    clearLoading();
  }, [clearLoading, listingSignature]);

  return (
    <div className={styles.container}>
      {children}
      {isPending ? (
        <div className={styles.overlay} aria-busy="true" aria-live="polite">
          <CustomerOrdersListingSkeleton
            itemCount={skeletonItemCount}
            hideTopPagination
            hideBottomPagination
          />
        </div>
      ) : null}
    </div>
  );
}
