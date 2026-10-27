'use client';

import { useState } from 'react';

import type { PagebuilderType } from '@/src/global/types';

import Accordion from '../../ui/Accordion';
import styles from './styles.module.scss';

type FaqListProps = NonNullable<PagebuilderType<'faqSection'>['faqList']>;

export default function FaqList({
  faqList,
  dataSanityById,
}: {
  faqList: FaqListProps;
  /** Draft-only: pre-built `data-sanity` per faq `_id` (built on the server). */
  dataSanityById?: Record<string, string | undefined>;
}) {
  const [openAccordionId, setOpenAccordionId] = useState<string | null>(
    faqList?.[0]?._id || null,
  );

  if (!faqList || faqList.length === 0) {
    return null;
  }

  const handleAccordionToggle = (faqId: string) => {
    setOpenAccordionId(openAccordionId === faqId ? null : faqId);
  };

  // Split FAQ items into two columns manually
  const leftColumnItems = faqList.filter((_, idx) => idx % 2 === 0);
  const rightColumnItems = faqList.filter((_, idx) => idx % 2 === 1);

  return (
    <div className={styles.faqList}>
      <div className={styles.column}>
        {leftColumnItems.map((faq) => (
          <Accordion
            key={faq._id}
            faq={faq}
            currentOpen={openAccordionId}
            onToggle={() => handleAccordionToggle(faq._id)}
            dataSanity={dataSanityById?.[faq._id]}
          />
        ))}
      </div>
      <div className={styles.column}>
        {rightColumnItems.map((faq) => (
          <Accordion
            key={faq._id}
            faq={faq}
            currentOpen={openAccordionId}
            onToggle={() => handleAccordionToggle(faq._id)}
            dataSanity={dataSanityById?.[faq._id]}
          />
        ))}
      </div>
    </div>
  );
}
