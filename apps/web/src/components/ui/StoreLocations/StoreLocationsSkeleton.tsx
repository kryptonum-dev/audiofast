import MapSkeleton from './MapSkeleton';
import styles from './styles.module.scss';

export interface StoreLocationsSkeletonProps {
  customId?: string;
  /** How many placeholder rows to draw — mirrors the real store count. */
  storeCount?: number;
}

/** The list scrolls after ~5 rows, so there is nothing to gain from drawing more. */
const MAX_SKELETON_ROWS = 5;

export default function StoreLocationsSkeleton({
  customId = 'gdzie-kupic',
  storeCount = 3,
}: StoreLocationsSkeletonProps) {
  const rows = Math.min(Math.max(storeCount, 1), MAX_SKELETON_ROWS);

  return (
    <section
      id={customId}
      className={`${styles.storeLocations} max-width-block`}
      aria-busy="true"
    >
      <div className={styles.mapWrapper}>
        <MapSkeleton />
      </div>
      <h2 className={styles.heading}>Gdzie kupić</h2>
      <ul className={styles.storesList} data-loading="true">
        {Array.from({ length: rows }).map((_, index) => (
          <li key={index} className={styles.store}>
            <div className={styles.skeletonInfo}>
              <div className={styles.skeletonName} />
              <div className={styles.skeletonAddress} />
            </div>
            <div className={styles.storeContact}>
              <div className={styles.skeletonContact} />
              <div className={styles.skeletonContact} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
