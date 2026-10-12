import styles from './styles.module.scss';

/**
 * TwoColumnLine component for portable text
 * Section boundary ("Nowa sekcja" in Studio): ends the current section.
 * The layout logic lives in UnifiedContentBlocks/split-into-sections.ts.
 */
export function TwoColumnLineComponent() {
  return (
    <div className={styles.twoColumnLine} role="separator" aria-hidden="true" />
  );
}
