import type { PortableTextBlock } from '@portabletext/react';
import {
  PortableText,
  type PortableTextComponentProps,
  type PortableTextMarkComponentProps,
} from '@portabletext/react';
import Link from 'next/link';
import React from 'react';

import type { PortableTextValue } from '@/global/types';

type Props = {
  value: PortableTextValue;
  className?: string;
  headingLevel?: 'h1' | 'h2' | 'h3' | 'h4';
  parentHeadingLevel?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  enablePortableTextStyles?: boolean;
};

export function PortableTextRenderer({
  value,
  className,
  headingLevel,
  parentHeadingLevel,
  enablePortableTextStyles = false,
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

    value.forEach((block: { style?: string }) => {
      if (block.style && headingMap[block.style] !== undefined) {
        const level = headingMap[block.style];
        if (
          level !== undefined &&
          (minLevel === undefined || level < minLevel)
        ) {
          minLevel = level;
        }
      }
    });

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
      normal: ({ children }: PortableTextComponentProps<PortableTextValue>) => {
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
      h1: ({ children }: PortableTextComponentProps<PortableTextValue>) => {
        const Tag = getActualHeading('h1');
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
      h2: ({ children }: PortableTextComponentProps<PortableTextValue>) => {
        const Tag = getActualHeading('h2');
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
      h3: ({ children }: PortableTextComponentProps<PortableTextValue>) => {
        const Tag = getActualHeading('h3');
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
      h4: ({ children }: PortableTextComponentProps<PortableTextValue>) => {
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
      h5: ({ children }: PortableTextComponentProps<PortableTextValue>) => {
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
      h6: ({ children }: PortableTextComponentProps<PortableTextValue>) => {
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
    },
    list: {
      // Handle bullet lists
      bullet: ({ children }: PortableTextComponentProps<PortableTextValue>) => (
        <ul
          className={
            isSingleBlock && !enablePortableTextStyles ? className : undefined
          }
        >
          {children}
        </ul>
      ),
      // Handle numbered lists
      number: ({ children }: PortableTextComponentProps<PortableTextValue>) => (
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
      bullet: ({ children }: PortableTextComponentProps<PortableTextValue>) => (
        <li>{children}</li>
      ),
      number: ({ children }: PortableTextComponentProps<PortableTextValue>) => (
        <li>{children}</li>
      ),
    },
    marks: {
      // Handle links
      customLink: ({ children, value }: PortableTextMarkComponentProps) => {
        const linkData = value?.customLink || {};
        const href = linkData?.href || '#';
        const linkType = linkData?.type;
        const openInNewTab = linkData?.openInNewTab;

        // Determine if it's an external link
        const isExternal =
          linkType === 'external' ||
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
  };

  // Apply wrapper only when enablePortableTextStyles is true or multiple blocks need grouping
  if (enablePortableTextStyles) {
    const wrapperClasses = ['portable-text', className]
      .filter(Boolean)
      .join(' ');
    return (
      <div className={wrapperClasses}>
        <PortableText
          value={value as PortableTextBlock}
          components={components}
        />
      </div>
    );
  }

  // For multiple blocks without portable text styles, wrap with custom className only
  if (!isSingleBlock && className) {
    return (
      <div className={className}>
        <PortableText
          value={value as PortableTextBlock}
          components={components}
        />
      </div>
    );
  }

  // For single blocks or no wrapper needed, render directly
  return (
    <PortableText value={value as PortableTextBlock} components={components} />
  );
}

export default PortableTextRenderer;
