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
  enablePortableTextStyles?: boolean;
};

export function PortableTextRenderer({
  value,
  className,
  headingLevel,
  enablePortableTextStyles = false,
}: Props) {
  if (!value) return null;

  // Check if we have only one block
  const isSingleBlock = Array.isArray(value) && value.length === 1;

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
      h1: ({ children }: PortableTextComponentProps<PortableTextValue>) => (
        <h1
          className={
            isSingleBlock && !enablePortableTextStyles ? className : undefined
          }
        >
          {children}
        </h1>
      ),
      h2: ({ children }: PortableTextComponentProps<PortableTextValue>) => (
        <h2
          className={
            isSingleBlock && !enablePortableTextStyles ? className : undefined
          }
        >
          {children}
        </h2>
      ),
      h3: ({ children }: PortableTextComponentProps<PortableTextValue>) => (
        <h3
          className={
            isSingleBlock && !enablePortableTextStyles ? className : undefined
          }
        >
          {children}
        </h3>
      ),
      h4: ({ children }: PortableTextComponentProps<PortableTextValue>) => (
        <h4
          className={
            isSingleBlock && !enablePortableTextStyles ? className : undefined
          }
        >
          {children}
        </h4>
      ),
      h5: ({ children }: PortableTextComponentProps<PortableTextValue>) => (
        <h5
          className={
            isSingleBlock && !enablePortableTextStyles ? className : undefined
          }
        >
          {children}
        </h5>
      ),
      h6: ({ children }: PortableTextComponentProps<PortableTextValue>) => (
        <h6
          className={
            isSingleBlock && !enablePortableTextStyles ? className : undefined
          }
        >
          {children}
        </h6>
      ),
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
      customLink: ({
        children,
        value,
      }: PortableTextMarkComponentProps<PortableTextValue>) => {
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
      strong: ({
        children,
      }: PortableTextMarkComponentProps<PortableTextValue>) => (
        <strong>{children}</strong>
      ),
      // Handle italic text
      em: ({ children }: PortableTextMarkComponentProps<PortableTextValue>) => (
        <em>{children}</em>
      ),
    },
  };

  // Apply wrapper only when enablePortableTextStyles is true or multiple blocks need grouping
  if (enablePortableTextStyles) {
    const wrapperClasses = ['portable-text', className]
      .filter(Boolean)
      .join(' ');
    return (
      <div className={wrapperClasses}>
        <PortableText value={value} components={components} />
      </div>
    );
  }

  // For multiple blocks without portable text styles, wrap with custom className only
  if (!isSingleBlock && className) {
    return (
      <div className={className}>
        <PortableText value={value} components={components} />
      </div>
    );
  }

  // For single blocks or no wrapper needed, render directly
  return <PortableText value={value} components={components} />;
}

export default PortableTextRenderer;
