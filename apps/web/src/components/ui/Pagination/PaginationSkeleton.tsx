import styles from './styles.module.scss';

export default function PaginationSkeleton() {
  return (
    <div className={styles.paginationSkeleton} aria-hidden="true">
      {/* Previous Arrow Skeleton */}
      <div className={styles.arrowSkeleton} />

      {/* Page Numbers Skeleton */}
      <div className={styles.pageNumberSkeleton} />
      <div className={styles.pageNumberSkeleton} />
      <div className={styles.pageNumberSkeleton} />
      <div className={styles.ellipsisSkeleton}>···</div>
      <div className={styles.pageNumberSkeleton} />

      {/* Next Arrow Skeleton */}
      <div className={styles.arrowSkeleton} />
    </div>
  );
}
