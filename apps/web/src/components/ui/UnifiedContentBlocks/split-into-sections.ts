import type { PortableTextProps } from '@/src/global/types';

export type ContentSection =
  | { type: 'single'; content: PortableTextProps }
  | {
      type: 'two-column';
      leftContent: PortableTextProps;
      rightContent: PortableTextProps;
    };

function getType(item: unknown): string | null {
  return item && typeof item === 'object' && '_type' in item
    ? (item as { _type: string })._type
    : null;
}

/**
 * Split content into sections.
 *
 * - ptTwoColumnLine ("Nowa sekcja" in Studio) always ends the current section.
 * - ptPageBreak ("Podział kolumn") splits the current section into a left and
 *   a right column.
 *
 * A section with a ptPageBreak and content on both sides renders as two
 * columns. Every other section renders as one column. Empty sections are
 * dropped, so extra or leading markers are harmless.
 */
export function splitIntoSections(
  content: PortableTextProps,
): ContentSection[] {
  if (!content || !Array.isArray(content)) return [];

  const sections: ContentSection[] = [];
  let left: unknown[] = [];
  let right: unknown[] = [];
  let hasBreak = false;

  const flush = () => {
    if (hasBreak && left.length > 0 && right.length > 0) {
      sections.push({
        type: 'two-column',
        leftContent: left as PortableTextProps,
        rightContent: right as PortableTextProps,
      });
    } else if (left.length > 0 || right.length > 0) {
      sections.push({
        type: 'single',
        content: [...left, ...right] as PortableTextProps,
      });
    }
    left = [];
    right = [];
    hasBreak = false;
  };

  for (const item of content) {
    const type = getType(item);

    if (type === 'ptTwoColumnLine') {
      flush();
    } else if (type === 'ptPageBreak') {
      hasBreak = true;
    } else if (hasBreak) {
      right.push(item);
    } else {
      left.push(item);
    }
  }

  flush();
  return sections;
}
