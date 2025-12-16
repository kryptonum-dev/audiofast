import { PRODUCTS_ITEMS_PER_PAGE } from '@/src/global/constants';

import PaginationSkeleton from '../../ui/Pagination/PaginationSkeleton';
import styles from './styles.module.scss';

type ProductsListingSkeletonProps = {
  /** Hide top pagination skeleton (for overlay mode where sort/pagination stay visible) */
  hideTopPagination?: boolean;
  /** Hide bottom pagination skeleton (for pagination/sort changes where bottom pagination stays visible) */
  hideBottomPagination?: boolean;
};

export default function ProductsListingSkeleton({
  hideTopPagination = false,
  hideBottomPagination = false,
}: ProductsListingSkeletonProps) {
  return (
    <>
      {/* Top Pagination Skeleton - hidden in overlay mode */}
      {!hideTopPagination && (
        <div className={styles.topPaginationSkeleton}>
          <PaginationSkeleton />
        </div>
      )}

      {/* Products Grid with Skeleton Cards */}
      <div className={styles.productsGrid} data-loading="true">
        {Array.from({ length: PRODUCTS_ITEMS_PER_PAGE }).map((_, index) => (
          <div key={index} className={styles.skeletonCard}>
            <div className={styles.skeletonImgBox}>
              <div className={styles.skeletonBrandLogo} />
            </div>
            <div className={styles.skeletonContainer}>
              <div className={styles.skeletonTitle} />
              <div className={styles.skeletonSubtitle} />
              <div className={styles.skeletonPriceContainer}>
                <div className={styles.skeletonPrice} />
                <div className={styles.skeletonButton} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Pagination Skeleton - hidden for pagination/sort changes */}
      {!hideBottomPagination && (
        <div className={styles.bottomPaginationSkeleton}>
          <PaginationSkeleton />
        </div>
      )}
    </>
  );
}
