import styles from './styles.module.scss';

export default function BlogListingSkeleton() {
  const ITEMS_PER_ROW = 2;
  const ROW_DELAY = 80; // delay between rows in ms

  return (
    <div className={styles.articlesGrid} data-loading="true">
      {Array.from({ length: 6 }).map((_, index) => {
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
              <div className={styles.skeletonPill} />
              <div className={styles.skeletonTitle} />
              <div className={styles.skeletonDescription}>
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLine} style={{ width: '70%' }} />
              </div>
              <div className={styles.skeletonButton} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
