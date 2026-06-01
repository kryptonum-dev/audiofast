import styles from './loading.module.scss';

export default function CustomerPanelLoading() {
  return (
    <section className={styles.loadingPanel} aria-label="Ładowanie panelu">
      <div className="spinnerWrapper">
        <div className="spinner" aria-hidden="true">
          <div className="spinnerRing" />
          <div className="spinnerRing" />
        </div>
      </div>
    </section>
  );
}
