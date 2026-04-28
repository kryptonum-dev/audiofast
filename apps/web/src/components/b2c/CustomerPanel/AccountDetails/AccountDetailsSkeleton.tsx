import styles from './skeleton.module.scss';

function SkeletonLine({ className }: { className?: string }) {
  return <span className={`${styles.skeletonLine} ${className ?? ''}`} />;
}

function SkeletonField({ wide = false }: { wide?: boolean }) {
  return (
    <div className={styles.field}>
      <SkeletonLine className={styles.fieldLabel} />
      <SkeletonLine
        className={`${styles.fieldInput} ${wide ? styles.fieldInputWide : ''}`}
      />
    </div>
  );
}

function SkeletonSection({
  children,
  fieldRows = 2,
  withToggle = false,
}: {
  children?: React.ReactNode;
  fieldRows?: number;
  withToggle?: boolean;
}) {
  return (
    <section className={styles.section} aria-hidden="true">
      <header className={styles.sectionHeader}>
        <SkeletonLine className={styles.sectionTitle} />
        <SkeletonLine className={styles.sectionDescription} />
      </header>

      {children ?? (
        <>
          {Array.from({ length: fieldRows }).map((_, index) => (
            <div key={index} className={styles.fieldGridTwo}>
              <SkeletonField />
              <SkeletonField />
            </div>
          ))}
        </>
      )}

      {withToggle ? (
        <div className={styles.toggleRow}>
          <span className={styles.toggleBox} />
          <SkeletonLine className={styles.toggleLabel} />
        </div>
      ) : null}
    </section>
  );
}

export default function AccountDetailsSkeleton() {
  return (
    <div
      className={styles.accountDetailsSkeleton}
      aria-label="Ładowanie danych konta"
      aria-busy="true"
    >
      <div className={styles.form}>
        <SkeletonSection />

        <SkeletonSection withToggle>
          <div className={styles.fieldGridTwoCompact}>
            <SkeletonField />
            <SkeletonField wide />
          </div>
          <SkeletonField wide />
          <div className={styles.fieldGridTwoCompact}>
            <SkeletonField />
            <SkeletonField wide />
          </div>
        </SkeletonSection>

        <SkeletonSection fieldRows={1}>
          <div className={styles.segmentedControl}>
            <SkeletonLine className={styles.segmentOption} />
            <SkeletonLine className={styles.segmentOption} />
          </div>
          <div className={styles.fieldGridTwo}>
            <SkeletonField />
            <SkeletonField />
          </div>
        </SkeletonSection>

        <div className={styles.footerBar} aria-hidden="true">
          <div className={styles.footerCopy}>
            <SkeletonLine className={styles.footerTitle} />
            <SkeletonLine className={styles.footerText} />
          </div>
          <SkeletonLine className={styles.footerButton} />
        </div>
      </div>
    </div>
  );
}
