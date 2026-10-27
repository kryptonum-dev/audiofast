import type { ScopedDataAttribute } from '@/src/global/sanity/data-attribute';
import type { PortableTextProps } from '@/src/global/types';

import PortableText from '../../portableText';
import { splitIntoSections } from './split-into-sections';
import styles from './styles.module.scss';

interface UnifiedContentBlocksProps {
  content: PortableTextProps;
  className?: string;
  /** Draft only: scoped to the portable-text field (`_key`s survive the split). */
  dataAttribute?: ScopedDataAttribute | null;
}

/**
 * UnifiedContentBlocks component
 * Renders a unified portable text array with support for column sections.
 *
 * Markers (see splitIntoSections):
 * - ptTwoColumnLine ("Nowa sekcja"): ends the current section
 * - ptPageBreak ("Podział kolumn"): splits a section into left and right columns
 */
export default function UnifiedContentBlocks({
  content,
  className,
  dataAttribute,
}: UnifiedContentBlocksProps) {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return null;
  }

  const sections = splitIntoSections(content);

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.unifiedContent} ${className || ''}`}>
      {sections.map((section, index) => {
        if (section.type === 'single') {
          return (
            <div key={index} className={styles.singleColumn}>
              <PortableText
                value={section.content}
                enablePortableTextStyles
                dataAttribute={dataAttribute}
                className={styles.columnContent}
              />
            </div>
          );
        }

        // Two-column section
        return (
          <div key={index} className={styles.twoColumn}>
            <div className={styles.leftColumn}>
              <PortableText
                value={section.leftContent}
                enablePortableTextStyles
                dataAttribute={dataAttribute}
                className={styles.columnContent}
              />
            </div>
            <div className={styles.rightColumn}>
              <PortableText
                value={section.rightContent}
                enablePortableTextStyles
                dataAttribute={dataAttribute}
                className={styles.columnContent}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
