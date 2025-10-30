import styles from './styles.module.scss';

export default function ProductsListingSkeleton() {
  const ITEMS_PER_ROW = 3;
  const ROW_DELAY = 80; // delay between rows in ms

  return (
    <div className={styles.productsGrid} data-loading="true">
      {Array.from({ length: 12 }).map((_, index) => {
        const row = Math.floor(index / ITEMS_PER_ROW);
        const delay = row * ROW_DELAY;

        return (
          <div
            key={index}
            className={styles.skeletonCard}
            style={{ animationDelay: `${delay}ms` }}
          >
            <div className={styles.skeletonImage} />
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonBrand} />
              <div className={styles.skeletonTitle} />
              <div className={styles.skeletonSubtitle} />
              <div className={styles.skeletonPrice} />
              <div className={styles.skeletonButton} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
