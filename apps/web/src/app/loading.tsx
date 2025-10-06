import styles from './loading.module.scss';

export default function Loading() {
  return (
    <div className={styles.loading}>
      <div className={styles.spinner}>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
      </div>
    </div>
  );
}
