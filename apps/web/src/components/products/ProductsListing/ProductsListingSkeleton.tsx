import { PRODUCTS_ITEMS_PER_PAGE } from "@/src/global/constants";

import PaginationSkeleton from "../../ui/Pagination/PaginationSkeleton";
import styles from "./styles.module.scss";

export default function ProductsListingSkeleton() {
  return (
    <>
      {/* Top Pagination Skeleton */}
      <div className={styles.topPaginationSkeleton}>
        <PaginationSkeleton />
      </div>

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

      {/* Bottom Pagination Skeleton */}
      <div className={styles.bottomPaginationSkeleton}>
        <PaginationSkeleton />
      </div>
    </>
  );
}
