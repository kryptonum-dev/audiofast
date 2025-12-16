import styles from "./styles.module.scss";

/**
 * Skeleton loader for ProductsAside
 *
 * Displayed during:
 * - Initial page load with URL params (SSR → hydration gap)
 * - When useSearchParams() triggers Suspense boundary
 *
 * Includes both mobile button and desktop sidebar structure
 * to match the actual ProductsAside layout.
 */
export default function ProductsAsideSkeleton() {
  return (
    <>
      {/* Mobile Open Button Skeleton */}
      <div className={styles.mobileOpenButton} aria-hidden="true">
        <MobileAsideIconSkeleton />
        <span>Filtry</span>
      </div>

      {/* Desktop Sidebar Skeleton */}
      <aside className={styles.sidebar} data-loading="true" aria-busy="true">
        {/* Search skeleton */}
        <div className={styles.skeletonSearch} />

        {/* Categories skeleton */}
        <div className={styles.section}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonList}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeletonItem} />
            ))}
          </div>
        </div>

        {/* Brands skeleton */}
        <div className={styles.section}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonList}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skeletonCheckbox} />
            ))}
          </div>
        </div>

        {/* Price range skeleton */}
        <div className={styles.section}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonPriceRange} />
        </div>

        {/* Button skeleton */}
        <div className={styles.filterActions}>
          <div className={styles.skeletonButton} />
        </div>
      </aside>
    </>
  );
}

const MobileAsideIconSkeleton = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#a)"
    >
      <path d="M4 8h4v4H4V8ZM6 4v4M6 12v8M10 14h4v4h-4v-4ZM12 4v10M12 18v2M16 5h4v4h-4V5ZM18 4v1M18 9v11" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
