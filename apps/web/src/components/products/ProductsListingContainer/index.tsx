'use client';

import { type ReactNode } from 'react';

import PaginationSkeleton from '../../ui/Pagination/PaginationSkeleton';
import ProductsListingSkeleton from '../ProductsListing/ProductsListingSkeleton';
import { useProductsLoading } from '../ProductsLoadingContext';
import styles from './styles.module.scss';

type ProductsListingContainerProps = {
  children: ReactNode;
};

/**
 * Client container that shows an overlay skeleton during filter transitions.
 *
 * This component wraps the Suspense boundary (which stays in the Server Component)
 * and adds an overlay skeleton when a filter change is in progress.
 *
 * Benefits:
 * - PPR works for initial load (Suspense is in Server Component)
 * - Instant visual feedback on filter clicks (overlay skeleton)
 * - Cached pages show no skeleton (navigation completes before delay)
 * - Uncached pages show skeleton after ~120ms delay
 */
export default function ProductsListingContainer({
  children,
}: ProductsListingContainerProps) {
  // Use showSkeleton (delayed) instead of isPending (immediate) for rendering skeleton
  // This prevents skeleton flash on cached pages while still showing it for slow loads
  const { showSkeleton, changeType } = useProductsLoading();

  // For filter changes: need to cover top pagination separately (sort dropdown stays visible)
  // For pagination/sort: only cover products grid (top pagination stays visible)
  const isFilterChange = changeType === 'filter';

  return (
    <div className={styles.container}>
      {children}
      {showSkeleton && (
        <>
          {/* For filter changes: separate overlay for top pagination area */}
          {isFilterChange && (
            <div className={styles.paginationOverlay} aria-hidden="true">
              <PaginationSkeleton />
            </div>
          )}
          {/* Main overlay for products grid (and bottom pagination for filter changes) */}
          <div
            className={styles.overlay}
            data-filter-change={isFilterChange}
            aria-busy="true"
            aria-live="polite"
          >
            {/* Hide top pagination - either real one visible or separate overlay covers it */}
            {/* Hide bottom pagination for pagination/sort changes - real one stays visible */}
            <ProductsListingSkeleton
              hideTopPagination
              hideBottomPagination={!isFilterChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
