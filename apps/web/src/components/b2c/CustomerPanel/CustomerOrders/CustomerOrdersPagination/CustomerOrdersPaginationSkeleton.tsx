import styles from './skeleton.module.scss';

export default function CustomerOrdersPaginationSkeleton() {
  return (
    <div className={styles.paginationSkeleton} aria-hidden="true">
      <div className={styles.arrowSkeleton} />
      <div className={styles.pageNumberSkeleton} />
      <div className={styles.pageNumberSkeleton} />
      <div className={styles.pageNumberSkeleton} />
      <div className={styles.ellipsisSkeleton}>···</div>
      <div className={styles.pageNumberSkeleton} />
      <div className={styles.arrowSkeleton} />
    </div>
  );
}
