'use client';

import styles from './CartLoadingSkeleton.module.scss';

export default function CartLoadingSkeleton() {
  return (
    <section
      className={styles.cartLoadingSkeleton}
      aria-live="polite"
      aria-busy="true"
      data-testid="cart-loading-state"
    >
      <span className={styles.visuallyHidden}>Trwa ładowanie koszyka...</span>

      <div className={styles.content} aria-hidden="true">
        <div className={styles.itemsColumn}>
          <LoadingCartItemSkeleton />
          <LoadingCartItemSkeleton />
        </div>

        <aside className={styles.sidebar}>
          <LoadingSummarySkeleton />
          <LoadingCouponSkeleton />
          <LoadingSupportSkeleton />
        </aside>
      </div>
    </section>
  );
}

function LoadingCartItemSkeleton() {
  return (
    <article className={styles.loadingItemCard} data-testid="cart-loading-item">
      <div className={`${styles.loadingMedia} ${styles.skeletonBlock}`} />

      <div className={styles.loadingIdentity}>
        <div className={`${styles.loadingBrand} ${styles.skeletonBlock}`} />
        <div className={`${styles.loadingTitle} ${styles.skeletonBlock}`} />
      </div>

      <div className={styles.loadingPriceBlock}>
        <div className={`${styles.loadingPrice} ${styles.skeletonBlock}`} />
      </div>

      <div className={styles.loadingQuantityStepper}>
        <div className={`${styles.loadingStepper} ${styles.skeletonBlock}`} />
      </div>

      <div className={styles.loadingConfiguration}>
        <div
          className={`${styles.loadingSectionHeading} ${styles.skeletonBlock}`}
        />

        <div className={styles.loadingConfigurationList}>
          <div className={styles.loadingConfigurationRow}>
            <div
              className={`${styles.loadingConfigurationLabel} ${styles.skeletonBlock}`}
            />
            <div
              className={`${styles.loadingConfigurationValue} ${styles.skeletonBlock}`}
            />
          </div>

          <div className={styles.loadingConfigurationRow}>
            <div
              className={`${styles.loadingConfigurationLabel} ${styles.skeletonBlock}`}
            />
            <div
              className={`${styles.loadingConfigurationValue} ${styles.skeletonBlock}`}
            />
          </div>
        </div>
      </div>

      <div className={styles.loadingActions}>
        <div className={`${styles.loadingAction} ${styles.skeletonBlock}`} />
      </div>
    </article>
  );
}

function LoadingSummarySkeleton() {
  return (
    <section
      className={styles.loadingSidebarCard}
      data-testid="cart-loading-summary"
    >
      <div
        className={`${styles.loadingSidebarHeading} ${styles.skeletonBlock}`}
      />

      <div className={styles.loadingSidebarRows}>
        <div className={styles.loadingSidebarRow}>
          <div
            className={`${styles.loadingSidebarLine} ${styles.skeletonBlock}`}
          />
          <div
            className={`${styles.loadingSidebarValue} ${styles.skeletonBlock}`}
          />
        </div>

        <div className={styles.loadingSidebarRow}>
          <div
            className={`${styles.loadingSidebarLine} ${styles.skeletonBlock}`}
          />
          <div
            className={`${styles.loadingSidebarValue} ${styles.skeletonBlock}`}
          />
        </div>

        <div
          className={`${styles.loadingSidebarRow} ${styles.loadingSidebarRowTotal}`}
        >
          <div
            className={`${styles.loadingSidebarLine} ${styles.skeletonBlock}`}
          />
          <div
            className={`${styles.loadingSidebarTotal} ${styles.skeletonBlock}`}
          />
        </div>
      </div>

      <div
        className={`${styles.loadingSidebarButton} ${styles.skeletonBlock}`}
      />
    </section>
  );
}

function LoadingCouponSkeleton() {
  return (
    <section
      className={styles.loadingSidebarCard}
      data-testid="cart-loading-coupon"
    >
      <div
        className={`${styles.loadingSidebarHeading} ${styles.skeletonBlock}`}
      />
      <div className={`${styles.loadingCouponField} ${styles.skeletonBlock}`} />
      <div
        className={`${styles.loadingCouponButton} ${styles.skeletonBlock}`}
      />
      <div className={`${styles.loadingCouponHint} ${styles.skeletonBlock}`} />
    </section>
  );
}

function LoadingSupportSkeleton() {
  return (
    <section
      className={styles.loadingSidebarCard}
      data-testid="cart-loading-support"
    >
      <div className={styles.loadingSupportCard}>
        <div
          className={`${styles.loadingSupportImage} ${styles.skeletonBlock}`}
        />

        <div className={styles.loadingSupportBody}>
          <div
            className={`${styles.loadingSupportParagraph} ${styles.skeletonBlock}`}
          />
          <div
            className={`${styles.loadingSupportParagraphShort} ${styles.skeletonBlock}`}
          />
          <div className={styles.loadingSupportPhone}>
            <div
              className={`${styles.loadingSupportIcon} ${styles.skeletonBlock}`}
            />
            <div
              className={`${styles.loadingSupportPhoneLine} ${styles.skeletonBlock}`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
