'use client';

import { useEffect, useState } from 'react';

import type { PortableTextValue } from '@/src/global/types';
import { convertToSlug, portableTextToPlainString } from '@/src/global/utils';

import styles from './styles.module.scss';

type HeadingGroup = {
  heading: { text: string; slug: string };
  subHeadings: { text: string; slug: string }[];
};

type Props = {
  title?: string;
  headings: PortableTextValue[];
};

export default function TableOfContent({
  title = 'Spis treści',
  headings,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string>('');

  // Handle link clicks to maintain focus after navigation
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const link = e.currentTarget;
    // Keep focus on the link after navigation
    setTimeout(() => {
      link.focus();
    }, 10);
  };

  // Group headings by H2 and their H3 children
  const groupedHeadings =
    headings?.reduce<HeadingGroup[]>((acc, heading) => {
      if (!heading || typeof heading !== 'object') return acc;

      const style = (heading as { style?: string }).style as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = portableTextToPlainString([heading as any]);
      const slug = convertToSlug(text) || '';

      if (style === 'h2') {
        acc.push({ heading: { text, slug }, subHeadings: [] });
      } else if (style === 'h3' && acc.length > 0) {
        const lastGroup = acc[acc.length - 1];
        if (lastGroup) {
          lastGroup.subHeadings.push({ text, slug });
        }
      }
      return acc;
    }, []) || [];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -80% 0px' }
    );

    const headingElements = document.querySelectorAll('h2[id], h3[id]');
    headingElements.forEach((elem) => observer.observe(elem));

    return () => observer.disconnect();
  }, []);

  return (
    <nav className={styles.TableOfContent}>
      <p>{title}</p>
      <div
        className={styles.wrapper}
        data-expanded={isExpanded ? 'true' : 'false'}
      >
        {groupedHeadings && (
          <ul className={styles.list}>
            {groupedHeadings.map(({ heading, subHeadings }, idx) => {
              const isHeadingActive = activeId === heading.slug;
              const hasActiveChild = subHeadings.some(
                (sub) => activeId === sub.slug
              );
              const shouldExpand = isHeadingActive || hasActiveChild;

              return (
                <li key={idx} data-expanded={shouldExpand ? 'true' : 'false'}>
                  <a
                    href={`#${heading.slug}`}
                    className={activeId === heading.slug ? styles.active : ''}
                    onClick={handleLinkClick}
                  >
                    {heading.text}
                    {subHeadings.length > 0 && <ChevronDownIcon />}
                  </a>
                  {subHeadings.length > 0 && (
                    <ul className={styles.subheadings}>
                      {subHeadings.map((sub, subIdx) => (
                        <li key={subIdx}>
                          <a
                            href={`#${sub.slug}`}
                            className={
                              activeId === sub.slug ? styles.active : ''
                            }
                            onClick={handleLinkClick}
                          >
                            {sub.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {groupedHeadings && groupedHeadings.length > 4 && (
          <button
            className={styles.showMore}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span>{isExpanded ? 'Pokaż mniej' : 'Pokaż więcej'}</span>
            <ChevronDownIcon />
          </button>
        )}
      </div>
    </nav>
  );
}

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">
    <path
      stroke="currentColor"
      fillRule="evenodd"
      d="M8.327 10.972a.462.462 0 0 1-.654 0L2.958 6.256a.462.462 0 0 1 0-.654l.218-.218c.18-.18.473-.18.654 0L8 9.554l4.17-4.17c.18-.18.474-.18.654 0l.218.218c.18.18.18.474 0 .654l-4.715 4.716Z"
      clipRule="evenodd"
    />
  </svg>
);
