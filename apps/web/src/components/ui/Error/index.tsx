import styles from './styles.module.scss';

export type ErrorTypes = {
  error?: string;
  withIcon?: boolean;
};

export default function Error({ error, withIcon }: ErrorTypes) {
  return (
    error && (
      <span
        className={styles.error}
        aria-live="assertive"
        role="alert"
        data-icon={withIcon}
      >
        {error}
      </span>
    )
  );
}
