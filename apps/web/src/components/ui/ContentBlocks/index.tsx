import type { PortableTextProps } from '@/src/global/types';

import PortableText from '../../portableText';
import { HorizontalLineBlock } from './HorizontalLineBlock';
import styles from './styles.module.scss';
import { VimeoBlock } from './VimeoBlock';
import { YoutubeBlock } from './YoutubeBlock';

// Type definitions for content blocks
export type ContentBlockText = {
  _type: 'contentBlockText';
  _key: string;
  content: PortableTextProps;
};

export type ContentBlockYoutube = {
  _type: 'contentBlockYoutube';
  _key: string;
  youtubeId: string;
  title?: string;
  thumbnail?: {
    id: string;
    preview?: string;
    alt?: string;
    naturalWidth?: number;
    naturalHeight?: number;
    hotspot?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    crop?: {
      bottom: number;
      left: number;
      right: number;
      top: number;
    };
  };
};

export type ContentBlockVimeo = {
  _type: 'contentBlockVimeo';
  _key: string;
  vimeoId: string;
  title?: string;
  thumbnail?: {
    id: string;
    preview?: string;
    alt?: string;
    naturalWidth?: number;
    naturalHeight?: number;
    hotspot?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    crop?: {
      bottom: number;
      left: number;
      right: number;
      top: number;
    };
  };
};

export type ContentBlockHorizontalLine = {
  _type: 'contentBlockHorizontalLine';
  _key: string;
};

export type ContentBlock =
  | ContentBlockText
  | ContentBlockYoutube
  | ContentBlockVimeo
  | ContentBlockHorizontalLine;

interface ContentBlocksProps {
  blocks: ContentBlock[] | null | undefined;
  className?: string;
}

type PortableTextItem = NonNullable<PortableTextProps>[number];

/**
 * Find the index of the first ptPageBreak in content
 * Returns -1 if no page break found
 */
function findPageBreakIndex(content: PortableTextProps): number {
  if (!content || !Array.isArray(content)) return -1;
  return content.findIndex(
    (item) =>
      item &&
      typeof item === 'object' &&
      '_type' in item &&
      (item as { _type: string })._type === 'ptPageBreak'
  );
}

/**
 * Split content at the page break into left and right columns
 * Returns null if no page break, otherwise returns [leftContent, rightContent]
 */
function splitContentAtPageBreak(
  content: PortableTextProps
): [PortableTextProps, PortableTextProps] | null {
  const pageBreakIndex = findPageBreakIndex(content);
  if (pageBreakIndex === -1 || !content) return null;

  const leftContent = content.slice(0, pageBreakIndex) as PortableTextItem[];
  // Skip the page break itself and take the rest
  const rightContent = content.slice(pageBreakIndex + 1) as PortableTextItem[];

  return [leftContent, rightContent];
}

/**
 * TextBlockRenderer - Renders a text block, handling column splits
 */
function TextBlockRenderer({ content }: { content: PortableTextProps }) {
  const splitContent = splitContentAtPageBreak(content);

  // No page break - render as single column
  if (!splitContent) {
    return (
      <div className={styles.textBlock}>
        <PortableText
          value={content}
          enablePortableTextStyles
          className={styles.textContentSingleColumn}
        />
      </div>
    );
  }

  const [leftContent, rightContent] = splitContent;

  // Has page break - render as two columns with natural sizing
  return (
    <div className={styles.textBlockTwoColumn}>
      <div className={styles.leftColumn}>
        <PortableText
          value={leftContent}
          enablePortableTextStyles
          className={styles.columnContent}
        />
      </div>
      {/* <div className={styles.columnDivider} /> */}
      <div className={styles.rightColumn}>
        <PortableText
          value={rightContent}
          enablePortableTextStyles
          className={styles.columnContent}
        />
      </div>
    </div>
  );
}

/**
 * ContentBlocks component
 * Renders an array of content blocks (text, youtube, horizontal line)
 * Used for brand and product detail pages
 */
export default function ContentBlocks({
  blocks,
  className,
}: ContentBlocksProps) {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.contentBlocks} ${className || ''}`}>
      {blocks.map((block) => {
        switch (block._type) {
          case 'contentBlockText':
            return (
              <TextBlockRenderer key={block._key} content={block.content} />
            );

          case 'contentBlockYoutube':
            return (
              <YoutubeBlock
                key={block._key}
                youtubeId={block.youtubeId}
                title={block.title}
                thumbnail={block.thumbnail}
              />
            );

          case 'contentBlockVimeo':
            return (
              <VimeoBlock
                key={block._key}
                vimeoId={block.vimeoId}
                title={block.title}
                thumbnail={block.thumbnail}
              />
            );

          case 'contentBlockHorizontalLine':
            return <HorizontalLineBlock key={block._key} />;

          default:
            return null;
        }
      })}
    </div>
  );
}
