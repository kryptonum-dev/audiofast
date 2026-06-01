import CustomerOrdersPaginationSkeleton from '../CustomerOrdersPagination/CustomerOrdersPaginationSkeleton';
import styles from './styles.module.scss';

type CustomerOrdersListingSkeletonProps = {
  itemCount?: number;
  hideTopPagination?: boolean;
  hideBottomPagination?: boolean;
};

export default function CustomerOrdersListingSkeleton({
  itemCount = 8,
  hideTopPagination = false,
  hideBottomPagination = false,
}: CustomerOrdersListingSkeletonProps) {
  return (
    <>
      {!hideTopPagination ? (
        <div className={styles.topPaginationSkeleton}>
          <CustomerOrdersPaginationSkeleton />
        </div>
      ) : null}
      <ul className={styles.skeletonList} aria-hidden="true">
        {Array.from({ length: itemCount }).map((_, index) => (
          <li key={index} className={styles.skeletonCard}>
            <div className={styles.skeletonImage} />
            <div className={styles.skeletonBody}>
              <div className={styles.skeletonEyebrow} />
              <div className={styles.skeletonTitle} />
              <div className={styles.skeletonMetaRow}>
                <div className={styles.skeletonMeta} />
                <div className={styles.skeletonMeta} />
              </div>
            </div>
            <div className={styles.skeletonActions}>
              <div className={styles.skeletonStatus} />
              <div className={styles.skeletonButton} />
            </div>
          </li>
        ))}
      </ul>
      {!hideBottomPagination ? (
        <div className={styles.bottomPaginationSkeleton}>
          <CustomerOrdersPaginationSkeleton />
        </div>
      ) : null}
    </>
  );
}
