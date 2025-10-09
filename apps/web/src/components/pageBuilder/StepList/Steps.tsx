'use client';

import { useEffect, useRef } from 'react';

import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../shared/PortableText';
import styles from './styles.module.scss';

type StepsProps = {
  steps: NonNullable<PagebuilderType<'stepList'>['steps']>;
};

export default function Steps({ steps }: StepsProps) {
  const stepsRef = useRef<HTMLOListElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stepsList = stepsRef.current;
    const line = lineRef.current;
    if (!stepsList || !line) return;

    const stepItems = Array.from(
      stepsList.querySelectorAll<HTMLLIElement>(`.${styles.step}`)
    );

    if (stepItems.length === 0) return;

    const firstItem = stepItems[0];

    // Scroll-based line animation
    const updateLineScale = () => {
      const listRect = stepsList.getBoundingClientRect();
      const viewportPoint = window.innerHeight * 0.66;

      const start = listRect.top - viewportPoint;
      const end = listRect.bottom - viewportPoint;
      const total = end - start;
      const current = -start;

      const progress = Math.max(0, Math.min(1, current / total));
      line.style.transform = `scaleY(${progress})`;
    };

    // Initial call wrapped in RAF to avoid forced reflow
    requestAnimationFrame(updateLineScale);

    let rafId: number;
    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateLineScale);

      // Ensure first item stays active
      if (firstItem && firstItem.getAttribute('data-active') !== 'true') {
        firstItem.setAttribute('data-active', 'true');
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    // IntersectionObserver for active steps (only observe items after the first)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.setAttribute(
            'data-active',
            entry.isIntersecting.toString()
          );
        });
      },
      {
        threshold: 0,
        rootMargin: `0px 0px -40% 0px`,
      }
    );

    // Only observe items from index 1 onwards (skip first item)
    stepItems.slice(1).forEach((item) => observer.observe(item));

    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  return (
    <div className={styles.stepsWrapper}>
      <ol ref={stepsRef} className={styles.steps}>
        {steps.map((step, index) => (
          <li
            key={step._key}
            className={styles.step}
            data-active={index === 0 ? 'true' : undefined}
          >
            <div className={styles.content}>
              <PortableText value={step.heading} className={styles.heading} />
              <PortableText
                value={step.description}
                enablePortableTextStyles
                className={styles.description}
              />
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.lineWrapper}>
        <div ref={lineRef} className={styles.line} />
      </div>
    </div>
  );
}
