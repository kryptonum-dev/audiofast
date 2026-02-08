import type { PortableTextBlock } from '@portabletext/react';
import {
  PortableText,
  type PortableTextComponentProps,
  type PortableTextComponents,
  type PortableTextMarkComponentProps,
} from '@portabletext/react';
import Link from 'next/link';
import type { PortableTextTypeComponentProps } from 'next-sanity';
import React, { Suspense } from 'react';

import type { PortableTextProps } from '@/global/types';
import { convertToSlug, portableTextToPlainString } from '@/global/utils';

import { ArrowListComponent } from './ArrowList';
import { ButtonPortableTextComponent } from './Button';
import { CircleNumberedListComponent } from './CircleNumberedList';
import { CtaSectionComponent } from './CtaSection';
import { FeaturedProductsComponent } from './FeaturedProducts';
import { HeadingComponent } from './Heading';
import { ImageComponent } from './Image';
import { ImageSliderComponent } from './ImageSlider';
import { InlineImageComponent } from './InlineImage';
import { MinimalImageComponent } from './MinimalImage';
import { PageBreakComponent } from './PageBreak';
import { QuoteComponent } from './Quote';
import { ReviewEmbedComponent } from './ReviewEmbed';
import portableTextStyles from './styles.module.scss';
import { TwoColumnLineComponent } from './TwoColumnLine';
import { TwoColumnTableComponent } from './TwoColumnTable';
import { VimeoVideoComponent } from './VimeoVideo';
import { YoutubeVideoComponent } from './YouTubeVideo';
import { YoutubeVideoSkeleton } from './YouTubeVideo/YoutubeVideoSkeleton';

type Props = {
  value: PortableTextProps;
  className?: string;
  headingLevel?: 'h1' | 'h2' | 'h3' | 'h4';
  parentHeadingLevel?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  enablePortableTextStyles?: boolean;
  addHeadingIds?: boolean;
  /** Optional override for custom component types (merges with default registry) */
  customComponentTypes?: PortableTextComponents['types'];
};

export function PortableTextRenderer({
  value,
  className,
  headingLevel,
  parentHeadingLevel,
  enablePortableTextStyles = false,
  addHeadingIds = false,
  customComponentTypes,
}: Props) {
  if (!value) return null;

  // Check if we have only one block
  const isSingleBlock = Array.isArray(value) && value.length === 1;

  // Find the minimum heading level used in the portable text
  const findMinHeadingLevel = (): number | null => {
    if (!Array.isArray(value) || !parentHeadingLevel) return null;

    const headingMap: Record<string, number> = {
      h1: 1,
      h2: 2,
      h3: 3,
      h4: 4,
      h5: 5,
      h6: 6,
    };

    let minLevel: number | undefined = undefined;

    value.forEach(
      (
        block: NonNullable<NonNullable<PortableTextProps>[number]> & {
          style?: string;
        },
      ) => {
        if (block.style && headingMap[block.style] !== undefined) {
          const level = headingMap[block.style];
          if (
            level !== undefined &&
            (minLevel === undefined || level < minLevel)
          ) {
            minLevel = level;
          }
        }
      },
    );

    return minLevel ?? null;
  };

  const minHeadingLevel = findMinHeadingLevel();

  // Helper function to normalize heading levels based on parent context
  // Maps the lowest heading in portable text to parent+1, maintains relative spacing
  const getActualHeading = (portableTextLevel: string): React.ElementType => {
    if (!parentHeadingLevel || minHeadingLevel === null) {
      // No parent context, use portable text levels as-is
      return portableTextLevel as React.ElementType;
    }

    const headingMap: Record<string, number> = {
      h1: 1,
      h2: 2,
      h3: 3,
      h4: 4,
      h5: 5,
      h6: 6,
    };

    const parentLevel = headingMap[parentHeadingLevel] || 1;
    const sanityLevel = headingMap[portableTextLevel] || 1;

    // Calculate offset from the minimum heading level found
    // If min is h3 and current is h4, offset = 4 - 3 = 1
    const offset = sanityLevel - minHeadingLevel;
    const actualLevel = Math.min(6, parentLevel + 1 + offset);

    return `h${actualLevel}` as React.ElementType;
  };

  const components = {
    block: {
      // Handle normal text blocks
      normal: ({ children }: PortableTextComponentProps<PortableTextProps>) => {
        const Tag = (headingLevel || 'p') as React.ElementType;
        return (
          <Tag
            className={
              isSingleBlock && !enablePortableTextStyles ? className : undefined
            }
          >
            {children}
          </Tag>
        );
      },
      // Handle heading styles
      h1: ({
        children,
        value: blockValue,
      }: PortableTextComponentProps<PortableTextProps>) => {
        const Tag = getActualHeading('h1');
        const id = addHeadingIds
          ? convertToSlug(
              portableTextToPlainString([
                blockValue as unknown as PortableTextBlock,
              ]),
            )
          : undefined;
        return (
          <Tag
            id={id}
            className={
              isSingleBlock && !enablePortableTextStyles ? className : undefined
            }
          >
            {children}
          </Tag>
        );
      },
      h2: ({
        children,
        value: blockValue,
      }: PortableTextComponentProps<PortableTextProps>) => {
        const Tag = getActualHeading('h2');
        const id = addHeadingIds
          ? convertToSlug(
              portableTextToPlainString([
                blockValue as unknown as PortableTextBlock,
              ]),
            )
          : undefined;
        return (
          <Tag
            id={id}
            className={
              isSingleBlock && !enablePortableTextStyles ? className : undefined
            }
          >
            {children}
          </Tag>
        );
      },
      h3: ({
        children,
        value: blockValue,
      }: PortableTextComponentProps<PortableTextProps>) => {
        const Tag = getActualHeading('h3');
        const id = addHeadingIds
          ? convertToSlug(
              portableTextToPlainString([
                blockValue as unknown as PortableTextBlock,
              ]),
            )
          : undefined;
        return (
          <Tag
            id={id}
            className={
              isSingleBlock && !enablePortableTextStyles ? className : undefined
            }
          >
            {children}
          </Tag>
        );
      },
      h4: ({ children }: PortableTextComponentProps<PortableTextProps>) => {
        const Tag = getActualHeading('h4');
        return (
          <Tag
            className={
              isSingleBlock && !enablePortableTextStyles ? className : undefined
            }
          >
            {children}
          </Tag>
        );
      },
      h5: ({ children }: PortableTextComponentProps<PortableTextProps>) => {
        const Tag = getActualHeading('h5');
        return (
          <Tag
            className={
              isSingleBlock && !enablePortableTextStyles ? className : undefined
            }
          >
            {children}
          </Tag>
        );
      },
      h6: ({ children }: PortableTextComponentProps<PortableTextProps>) => {
        const Tag = getActualHeading('h6');
        return (
          <Tag
            className={
              isSingleBlock && !enablePortableTextStyles ? className : undefined
            }
          >
            {children}
          </Tag>
        );
      },
      // Handle blockquotes
      blockquote: ({
        children,
      }: PortableTextComponentProps<PortableTextProps>) => (
        <blockquote>{children}</blockquote>
      ),
    },
    list: {
      // Handle bullet lists
      bullet: ({ children }: PortableTextComponentProps<PortableTextProps>) => (
        <ul
          className={
            isSingleBlock && !enablePortableTextStyles ? className : undefined
          }
        >
          {children}
        </ul>
      ),
      // Handle numbered lists
      number: ({ children }: PortableTextComponentProps<PortableTextProps>) => (
        <ol
          className={
            isSingleBlock && !enablePortableTextStyles ? className : undefined
          }
        >
          {children}
        </ol>
      ),
    },
    listItem: {
      // Handle list items for both bullet and number lists
      bullet: ({ children }: PortableTextComponentProps<PortableTextProps>) => (
        <li>{children}</li>
      ),
      number: ({ children }: PortableTextComponentProps<PortableTextProps>) => (
        <li>{children}</li>
      ),
    },
    marks: {
      // Handle customLink (used in most portable text fields)
      customLink: ({ children, value }: PortableTextMarkComponentProps) => {
        const linkData = value?.customLink || {};
        const href = linkData?.href || '#';
        const linkType = linkData?.type;
        const openInNewTab = linkData?.openInNewTab;

        // Determine if it's an external link
        // Use the actual URL to decide, not the Sanity linkType field.
        // Relative paths (e.g. /produkty/...) are always internal regardless of how they're stored.
        const isExternalUrl =
          href.startsWith('http') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:');
        const isExternal = isExternalUrl || openInNewTab;

        // For external links, use regular <a> tag
        if (isExternal) {
          return (
            <a
              href={href}
              className="link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        }

        // For internal links, use Next.js Link
        return (
          <Link href={href} className="link">
            {children}
          </Link>
        );
      },
      // Handle link (used in technical data cells)
      link: ({ children, value }: PortableTextMarkComponentProps) => {
        const href = value?.href || '#';
        const openInNewTab = value?.blank;

        // Determine if it's an external link
        const isExternal =
          openInNewTab ||
          href.startsWith('http') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:');

        // For external links, use regular <a> tag
        if (isExternal) {
          return (
            <a
              href={href}
              className="link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        }

        // For internal links, use Next.js Link
        return (
          <Link href={href} className="link">
            {children}
          </Link>
        );
      },
      // Handle strong/bold text
      strong: ({ children }: PortableTextMarkComponentProps) => (
        <strong>{children}</strong>
      ),
      // Handle italic text
      em: ({ children }: PortableTextMarkComponentProps) => <em>{children}</em>,
    },
    // Custom component types from registry (with optional overrides)
    types: {
      ...{
        ptImage: ImageComponent,
        ptMinimalImage: MinimalImageComponent,
        ptInlineImage: InlineImageComponent,
        ptImageSlider: ImageSliderComponent,
        ptArrowList: ArrowListComponent,
        ptCircleNumberedList: CircleNumberedListComponent,
        ptCtaSection: CtaSectionComponent,
        ptTwoColumnTable: TwoColumnTableComponent,
        ptFeaturedProducts: FeaturedProductsComponent,
        ptQuote: QuoteComponent,
        ptButton: ButtonPortableTextComponent,
        ptHeading: HeadingComponent,
        ptYoutubeVideo: (
          props: PortableTextTypeComponentProps<PortableTextProps>,
        ) => {
          return (
            <Suspense fallback={<YoutubeVideoSkeleton />}>
              {/* @ts-expect-error - Async component in Suspense boundary */}
              <YoutubeVideoComponent value={props.value} />
            </Suspense>
          );
        },
        ptVimeoVideo: (
          props: PortableTextTypeComponentProps<PortableTextProps>,
        ) => {
          return (
            <Suspense fallback={<YoutubeVideoSkeleton />}>
              {/* @ts-expect-error - Async component in Suspense boundary */}
              <VimeoVideoComponent value={props.value} />
            </Suspense>
          );
        },
        ptPageBreak: () => {
          return <PageBreakComponent />;
        },
        ptTwoColumnLine: () => {
          return <TwoColumnLineComponent />;
        },
        ptHorizontalLine: () => {
          return <hr className={portableTextStyles.horizontalLine} />;
        },
        ptReviewEmbed: ReviewEmbedComponent,
      },
      ...customComponentTypes,
    },
  };

  // Apply wrapper only when enablePortableTextStyles is true or multiple blocks need grouping
  if (enablePortableTextStyles) {
    const wrapperClasses = [portableTextStyles.portableText, className]
      .filter(Boolean)
      .join(' ');
    return (
      <div className={wrapperClasses}>
        <PortableText
          value={value as unknown as PortableTextBlock}
          components={components as unknown as PortableTextComponents}
        />
      </div>
    );
  }

  // For multiple blocks without portable text styles, wrap with custom className only
  if (!isSingleBlock && className) {
    return (
      <div className={className}>
        <PortableText
          value={value as unknown as PortableTextBlock}
          components={components as unknown as PortableTextComponents}
        />
      </div>
    );
  }

  // For single blocks or no wrapper needed, render directly
  return (
    <PortableText
      value={value as unknown as PortableTextBlock}
      components={components as unknown as PortableTextComponents}
    />
  );
}

export default PortableTextRenderer;
