'use client';

import { useRef } from 'react';

import type { QueryHomePageResult } from '../../../global/sanity/sanity.types';
import PortableText from '../../shared/PortableText';
import styles from './styles.module.scss';

// Extract the FAQ type from the resolved QueryHomePageResult
type ResolvedFaqSection = Extract<
  NonNullable<NonNullable<QueryHomePageResult>['pageBuilder']>[number],
  { _type: 'faqSection' }
>;

export type FaqType = NonNullable<ResolvedFaqSection['faqList']>[number];

interface AccordionProps {
  faq: FaqType;
  currentOpen: string | null;
  onToggle: () => void;
}

export default function Accordion({
  faq,
  currentOpen,
  onToggle,
}: AccordionProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const isOpen = currentOpen === faq._id;

  return (
    <details
      ref={detailsRef}
      className={styles.accordion}
      data-expanded={isOpen}
      open
    >
      <summary
        className={styles.summary}
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <PlusMinusIcon isOpen={isOpen} />
        <p className={styles.questionText}>{faq.question}</p>
      </summary>

      <div className={styles.content}>
        <div className={styles.inner}>
          <PortableText
            value={faq.answer}
            enablePortableTextStyles
            className={styles.answerText}
          />
        </div>
      </div>
    </details>
  );
}

const PlusMinusIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="none"
    aria-hidden="true"
  >
    {/* Horizontal line - always visible */}
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M4 10h12"
    />
    {/* Vertical line - scales down when open */}
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10 4v12"
      style={{
        transform: isOpen ? 'scaleY(0)' : 'scaleY(1)',
        transformOrigin: 'center',
        transition: 'transform 350ms cubic-bezier(0.4, 0.0, 0.2, 1)',
      }}
    />
  </svg>
);
