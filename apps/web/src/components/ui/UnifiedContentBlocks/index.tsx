import type { PortableTextProps } from '@/src/global/types';

import PortableText from '../../portableText';
import styles from './styles.module.scss';

interface UnifiedContentBlocksProps {
  content: PortableTextProps;
  className?: string;
}

type ContentSection = {
  type: 'single' | 'two-column';
  content: PortableTextProps;
  leftContent?: PortableTextProps;
  rightContent?: PortableTextProps;
};

/**
 * Split content into sections based on ptTwoColumnLine and ptPageBreak markers.
 *
 * Logic:
 * - ptPageBreak: Divides left and right columns. If encountered while in single-column
 *   mode, it implicitly starts a two-column section (accumulated content → left column).
 * - ptTwoColumnLine: Explicitly ends a two-column section and returns to single-column.
 *   Only needed when there's single-column content AFTER a two-column section.
 *
 * Example 1 - Two-column at start (NO ptTwoColumnLine needed):
 *   Content A, [ptPageBreak], Content B
 *   → Two columns: Left=[A], Right=[B]
 *
 * Example 2 - Two-column with single-column after:
 *   Content A, [ptPageBreak], Content B, [ptTwoColumnLine], Content Y
 *   → Two columns: Left=[A], Right=[B]
 *   → Single: [Y]
 *
 * Example 3 - Single-column before two-column:
 *   Content X, [ptTwoColumnLine], Content A, [ptPageBreak], Content B
 *   → Single: [X]
 *   → Two columns: Left=[A], Right=[B]
 */
function splitIntoSections(content: PortableTextProps): ContentSection[] {
  if (!content || !Array.isArray(content)) return [];

  const sections: ContentSection[] = [];

  // State machine:
  // - 'single': Collecting single-column content
  // - 'left': Inside two-column section, collecting for left column (before ptPageBreak)
  // - 'right': Inside two-column section, collecting for right column (after ptPageBreak)
  type State = 'single' | 'left' | 'right';
  let state: State = 'single';

  let singleContent: any[] = [];
  let leftContent: any[] = [];
  let rightContent: any[] = [];

  for (const item of content) {
    const itemType =
      item && typeof item === 'object' && '_type' in item
        ? (item as { _type: string })._type
        : null;

    if (itemType === 'ptTwoColumnLine') {
      if (state === 'single') {
        // Entering two-column section explicitly
        // Flush any accumulated single content first
        if (singleContent.length > 0) {
          sections.push({ type: 'single', content: singleContent });
          singleContent = [];
        }
        // Start collecting for left column
        state = 'left';
        leftContent = [];
        rightContent = [];
      } else {
        // Exiting two-column section (state is 'left' or 'right')
        // Flush the two-column section
        sections.push({
          type: 'two-column',
          content: [...leftContent, ...rightContent],
          leftContent,
          rightContent,
        });
        leftContent = [];
        rightContent = [];
        state = 'single';
      }
    } else if (itemType === 'ptPageBreak') {
      if (state === 'single') {
        // ptPageBreak while in single mode = implicit start of two-column section
        // All accumulated single content becomes the left column
        leftContent = [...singleContent];
        singleContent = [];
        state = 'right';
      } else if (state === 'left') {
        // Switch from left to right column
        state = 'right';
      }
      // If already in 'right' state, ignore additional ptPageBreak
    } else {
      // Regular content - add to appropriate collection based on state
      if (state === 'single') {
        singleContent.push(item);
      } else if (state === 'left') {
        leftContent.push(item);
      } else if (state === 'right') {
        rightContent.push(item);
      }
    }
  }

  // Flush remaining content
  if (state === 'single') {
    if (singleContent.length > 0) {
      sections.push({ type: 'single', content: singleContent });
    }
  } else {
    // Two-column section at the end - no closing ptTwoColumnLine needed
    sections.push({
      type: 'two-column',
      content: [...leftContent, ...rightContent],
      leftContent,
      rightContent,
    });
  }

  return sections;
}

/**
 * UnifiedContentBlocks component
 * Renders a unified portable text array with support for column sections.
 *
 * Markers:
 * - ptTwoColumnLine: Boundary marker (toggle) for two-column sections
 * - ptPageBreak: Divider between left and right columns within a two-column section
 */
export default function UnifiedContentBlocks({
  content,
  className,
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
                className={styles.columnContent}
              />
            </div>
            <div className={styles.rightColumn}>
              <PortableText
                value={section.rightContent}
                enablePortableTextStyles
                className={styles.columnContent}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
