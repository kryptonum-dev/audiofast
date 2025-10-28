import styles from './styles.module.scss';

export default function BlogListingSkeleton() {
  return (
    <div className={styles.articlesGrid} data-loading="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={styles.skeletonCard}
          style={{ animationDelay: `${index * 60}ms` }}
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
      ))}
    </div>
  );
}
