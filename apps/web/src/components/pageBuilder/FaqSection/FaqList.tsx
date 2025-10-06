'use client';

import { useState } from 'react';

import type { FaqSection } from '@/src/global/sanity/sanity.types';

import type { FaqType } from '../../ui/Accordion';
import Accordion from '../../ui/Accordion';
import styles from './styles.module.scss';

export default function FaqList({
  faqList,
}: {
  faqList: FaqSection['faqList'];
}) {
  const [openAccordionId, setOpenAccordionId] = useState<string | null>(
    faqList?.[0]?._ref || null
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
            key={faq._ref}
            faq={faq as unknown as FaqType}
            currentOpen={openAccordionId}
            onToggle={() => handleAccordionToggle(faq._ref)}
          />
        ))}
      </div>
      <div className={styles.column}>
        {rightColumnItems.map((faq) => (
          <Accordion
            key={faq._ref}
            faq={faq as unknown as FaqType}
            currentOpen={openAccordionId}
            onToggle={() => handleAccordionToggle(faq._ref)}
          />
        ))}
      </div>
    </div>
  );
}
