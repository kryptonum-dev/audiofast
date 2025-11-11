'use client';

import styles from './styles.module.scss';

type AddToComparisonProps = {
  Icon: React.ReactNode;
};

export default function AddToComparison({ Icon }: AddToComparisonProps) {
  return (
    <button
      className={styles.addToComparison}
      onClick={() => {
        console.log('add to comparison');
      }}
      type="button"
      aria-label="Dodaj do porównania"
    >
      {Icon}
      <span className={styles.addToComparisonText}>Dodaj do porównania</span>
    </button>
  );
}
