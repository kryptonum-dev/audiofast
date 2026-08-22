'use client';

import { useRef } from 'react';

import styles from './styles.module.scss';

type Props = {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  ariaLabel?: {
    base: string;
    goTo: string;
  };
  outline?: 'light' | 'dark';
};

export default function PaginationDots({
  count,
  activeIndex,
  outline = 'dark',
  onSelect,
  ariaLabel = {
    base: 'Paginacja',
    goTo: 'Przejdź do',
  },
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  if (!count || count <= 1) return null;

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel.base}
      className={styles.paginationDots}
      data-outline={outline}
      data-count={count}
      style={
        {
          '--active-index': activeIndex.toString(),
          '--total-count': count.toString(),
        } as React.CSSProperties
      }
    >
      <div ref={indicatorRef} className={styles.indicator} aria-hidden="true" />
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === activeIndex}
          aria-label={`${ariaLabel.goTo} ${i + 1}`}
          aria-current={i === activeIndex}
          data-active={i === activeIndex}
          className={styles.dot}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
