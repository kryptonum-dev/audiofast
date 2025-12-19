import styles from './PricingSkeleton.module.scss';

/**
 * Skeleton loader for the pricing configurator.
 * Displayed while pricing data is being fetched from Supabase.
 */
export default function PricingSkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Ładowanie cennika...">
      {/* Option group skeleton */}
      <div className={styles.optionGroup}>
        <div className={styles.label} />
        <div className={styles.dropdown} />
      </div>

      {/* Second option group skeleton */}
      <div className={styles.optionGroup}>
        <div className={styles.label} />
        <div className={styles.dropdown} />
      </div>

      {/* Price display skeleton */}
      <div className={styles.priceDisplay}>
        <div className={styles.priceLabel} />
        <div className={styles.price} />
      </div>
    </div>
  );
}
