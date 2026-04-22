import styles from './CheckoutLoadingSkeleton.module.scss';

export default function CheckoutLoadingSkeleton() {
  return (
    <main id="main">
      <section
        className={`${styles.checkoutLoadingSkeleton} max-width`}
        aria-live="polite"
        aria-busy="true"
        data-testid="checkout-loading-state"
      >
        <span className={styles.visuallyHidden}>
          Trwa ładowanie formularza zamówienia...
        </span>

        <div className={styles.layout} aria-hidden="true">
          <div className={styles.formColumn}>
            <section className={styles.previewCard}>
              <div className={styles.sectionHeader}>
                <div
                  className={`${styles.previewHeading} ${styles.skeletonBlock}`}
                />
                <div
                  className={`${styles.previewAction} ${styles.skeletonBlock}`}
                />
              </div>

              <div className={styles.previewList}>
                <LoadingPreviewItemSkeleton />
                <LoadingPreviewItemSkeleton />
                <LoadingPreviewItemSkeleton />
              </div>
            </section>

            <LoadingFormSectionSkeleton
              headingClassName={styles.contactHeading ?? ''}
              rowCount={2}
            />
            <LoadingFormSectionSkeleton
              headingClassName={styles.buyerHeading ?? ''}
              rowCount={2}
              showInlineOptions
            />
            <LoadingFormSectionSkeleton
              headingClassName={styles.shippingHeading ?? ''}
              rowCount={3}
            />
            <LoadingFormSectionSkeleton
              headingClassName={styles.consentsHeading ?? ''}
              rowCount={2}
              showCheckboxRows
            />
          </div>

          <aside className={styles.sidebar}>
            <LoadingSummarySkeleton />
            <LoadingSupportSkeleton />
          </aside>
        </div>
      </section>
    </main>
  );
}

function LoadingPreviewItemSkeleton() {
  return (
    <div className={styles.previewItem}>
      <div className={`${styles.previewMedia} ${styles.skeletonBlock}`} />

      <div className={styles.previewMeta}>
        <div
          className={`${styles.previewLinePrimary} ${styles.skeletonBlock}`}
        />
        <div
          className={`${styles.previewLineSecondary} ${styles.skeletonBlock}`}
        />
      </div>

      <div className={`${styles.previewPrice} ${styles.skeletonBlock}`} />
    </div>
  );
}

function LoadingFormSectionSkeleton({
  headingClassName,
  rowCount,
  showInlineOptions = false,
  showCheckboxRows = false,
}: {
  headingClassName: string;
  rowCount: number;
  showInlineOptions?: boolean;
  showCheckboxRows?: boolean;
}) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div className={`${headingClassName} ${styles.skeletonBlock}`} />
      </div>

      {showInlineOptions ? (
        <div className={styles.inlineOptions}>
          <div className={`${styles.inlineOption} ${styles.skeletonBlock}`} />
          <div className={`${styles.inlineOption} ${styles.skeletonBlock}`} />
        </div>
      ) : null}

      <div className={styles.formRows}>
        {Array.from({ length: rowCount }, (_, index) => (
          <div key={index} className={styles.formRow}>
            <div className={`${styles.fieldLabel} ${styles.skeletonBlock}`} />
            <div className={`${styles.fieldInput} ${styles.skeletonBlock}`} />
          </div>
        ))}
      </div>

      {showCheckboxRows ? (
        <div className={styles.checkboxRows}>
          <div className={styles.checkboxRow}>
            <div className={`${styles.checkboxBox} ${styles.skeletonBlock}`} />
            <div className={`${styles.checkboxLine} ${styles.skeletonBlock}`} />
          </div>
          <div className={styles.checkboxRow}>
            <div className={`${styles.checkboxBox} ${styles.skeletonBlock}`} />
            <div
              className={`${styles.checkboxLineShort} ${styles.skeletonBlock}`}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LoadingSummarySkeleton() {
  return (
    <section className={styles.sidebarCard}>
      <div className={`${styles.sidebarHeading} ${styles.skeletonBlock}`} />

      <div className={styles.summaryRows}>
        <div className={styles.summaryRow}>
          <div className={`${styles.summaryLine} ${styles.skeletonBlock}`} />
          <div className={`${styles.summaryValue} ${styles.skeletonBlock}`} />
        </div>
        <div className={styles.summaryRow}>
          <div className={`${styles.summaryLine} ${styles.skeletonBlock}`} />
          <div className={`${styles.summaryValue} ${styles.skeletonBlock}`} />
        </div>
        <div className={`${styles.summaryRow} ${styles.summaryRowTotal}`}>
          <div className={`${styles.summaryLine} ${styles.skeletonBlock}`} />
          <div className={`${styles.summaryTotal} ${styles.skeletonBlock}`} />
        </div>
      </div>

      <div className={`${styles.summaryButton} ${styles.skeletonBlock}`} />
    </section>
  );
}

function LoadingSupportSkeleton() {
  return (
    <section className={styles.sidebarCard}>
      <div className={styles.supportCard}>
        <div className={`${styles.supportAvatar} ${styles.skeletonBlock}`} />

        <div className={styles.supportBody}>
          <div className={`${styles.supportLine} ${styles.skeletonBlock}`} />
          <div
            className={`${styles.supportLineShort} ${styles.skeletonBlock}`}
          />
          <div className={styles.supportPhone}>
            <div className={`${styles.supportIcon} ${styles.skeletonBlock}`} />
            <div
              className={`${styles.supportPhoneLine} ${styles.skeletonBlock}`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
