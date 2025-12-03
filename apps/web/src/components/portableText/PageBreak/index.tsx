import styles from "./styles.module.scss";

/**
 * PageBreak component for portable text
 * Indicates a visual break between content sections
 * In two-column layouts, this creates a column break
 */
export function PageBreakComponent() {
  return (
    <div className={styles.pageBreak} role="separator" aria-hidden="true" />
  );
}
