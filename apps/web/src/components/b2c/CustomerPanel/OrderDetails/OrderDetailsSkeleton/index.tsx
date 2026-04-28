import styles from './styles.module.scss';

function SkeletonLine({ className }: { className?: string }) {
  return <span className={`${styles.skeletonLine} ${className ?? ''}`} />;
}

function DetailRows({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.detailRows}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={styles.detailRow}>
          <SkeletonLine className={styles.detailLabel} />
          <SkeletonLine className={styles.detailValue} />
        </div>
      ))}
    </div>
  );
}

export default function OrderDetailsSkeleton() {
  return (
    <article
      className={styles.orderDetailSkeleton}
      aria-label="Ładowanie szczegółów zamówienia"
      aria-busy="true"
    >
      <header className={styles.pageHeader}>
        <SkeletonLine className={styles.title} />
        <SkeletonLine className={styles.backButton} />
      </header>

      <section className={styles.orderFacts} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={styles.factItem}>
            <SkeletonLine className={styles.factLabel} />
            <SkeletonLine className={styles.factValue} />
          </div>
        ))}
      </section>

      <section className={styles.productsSection} aria-hidden="true">
        <SkeletonLine className={styles.sectionHeading} />
        <ul className={styles.productList}>
          {Array.from({ length: 2 }).map((_, index) => (
            <li key={index} className={styles.productItem}>
              <span className={styles.productImage} />
              <div className={styles.productBody}>
                <SkeletonLine className={styles.productBrand} />
                <SkeletonLine className={styles.productTitle} />
                <div className={styles.productChips}>
                  <SkeletonLine className={styles.productChip} />
                  <SkeletonLine className={styles.productChip} />
                </div>
              </div>
              <div className={styles.productValue}>
                <SkeletonLine className={styles.productQuantity} />
                <SkeletonLine className={styles.productPrice} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.twoColumnRow} aria-hidden="true">
        <section className={styles.timelineSection}>
          <SkeletonLine className={styles.sectionHeading} />
          <div className={styles.timelineItems}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={styles.timelineItem}>
                <span className={styles.timelineMarker} />
                <div className={styles.timelineContent}>
                  <SkeletonLine className={styles.timelineTitle} />
                  <SkeletonLine className={styles.timelineDate} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.summarySection}>
          <SkeletonLine className={styles.sectionHeading} />
          <div className={styles.summaryRows}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={styles.summaryRow}>
                <div>
                  <SkeletonLine className={styles.summaryLabel} />
                  <SkeletonLine className={styles.summaryMeta} />
                </div>
                <SkeletonLine className={styles.summaryPrice} />
              </div>
            ))}
          </div>
          <div className={styles.summaryTotal}>
            <SkeletonLine className={styles.summaryTotalLabel} />
            <SkeletonLine className={styles.summaryTotalPrice} />
          </div>
        </section>
      </div>

      <section className={styles.orderDataSection} aria-hidden="true">
        <SkeletonLine className={styles.sectionHeading} />
        <div className={styles.orderDataColumns}>
          <div className={styles.orderDataColumn}>
            <SkeletonLine className={styles.columnHeading} />
            <DetailRows count={3} />
          </div>
          <div className={styles.orderDataColumn}>
            <SkeletonLine className={styles.columnHeading} />
            <DetailRows count={4} />
          </div>
          <div className={styles.orderDataColumn}>
            <SkeletonLine className={styles.columnHeading} />
            <DetailRows count={2} />
            <SkeletonLine className={styles.trackingButton} />
          </div>
        </div>

        <div className={styles.invoiceCard}>
          <span className={styles.invoiceIcon} />
          <div className={styles.invoiceBody}>
            <SkeletonLine className={styles.invoiceTitle} />
            <SkeletonLine className={styles.invoiceCopy} />
          </div>
          <SkeletonLine className={styles.invoiceButton} />
        </div>
      </section>

      <div className={styles.actionsRow} aria-hidden="true">
        <section className={styles.actionCard}>
          <SkeletonLine className={styles.sectionHeading} />
          <SkeletonLine className={styles.actionCopy} />
          <SkeletonLine className={styles.actionButton} />
        </section>
        <section className={styles.actionCard}>
          <SkeletonLine className={styles.sectionHeading} />
          <div className={styles.statusPill}>
            <span className={styles.statusIcon} />
            <div>
              <SkeletonLine className={styles.statusLabel} />
              <SkeletonLine className={styles.statusValue} />
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
