import styles from './loading.module.scss';

export default function CustomerPanelLoading() {
  return (
    <section className={styles.loadingPanel} aria-label="Ładowanie panelu">
      <div className={styles.loadingCard}>
        <span className={styles.loadingLine} />
        <span className={styles.loadingLine} />
        <span className={styles.loadingLine} />
      </div>
    </section>
  );
}
