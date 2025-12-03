"use client";

import styles from "./styles.module.scss";

export type ErrorTypes = {
  children: React.ReactNode;
  withIcon?: boolean;
};

export default function Error({ children, withIcon }: ErrorTypes) {
  if (!children) return null;
  return (
    <span
      className={styles.error}
      aria-live="assertive"
      role="alert"
      data-icon={withIcon}
    >
      {children}
    </span>
  );
}
