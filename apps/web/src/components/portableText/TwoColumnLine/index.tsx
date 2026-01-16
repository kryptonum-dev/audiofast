import styles from './styles.module.scss';

/**
 * TwoColumnLine component for portable text
 * Acts as a boundary marker for two-column sections.
 * Content between two TwoColumnLine markers is displayed in two columns.
 * The actual layout logic is handled by the parent UnifiedContentBlocks component.
 */
export function TwoColumnLineComponent() {
  return (
    <div
      className={styles.twoColumnLine}
      role="separator"
      aria-hidden="true"
    />
  );
}
