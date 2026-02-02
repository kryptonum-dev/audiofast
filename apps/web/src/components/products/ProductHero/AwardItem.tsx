'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { SanityRawImage } from '@/components/shared/Image';
import Image from '@/components/shared/Image';

import styles from './styles.module.scss';

interface AwardItemProps {
  award: {
    _id: string;
    name: string;
    logo?: SanityRawImage | null;
  };
  isDuplicate?: boolean;
}

interface TooltipPosition {
  top: number;
  left: number;
}

export default function AwardItem({ award, isDuplicate }: AwardItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Only render portal on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const calculatePosition = useCallback(() => {
    if (!itemRef.current) return;

    const rect = itemRef.current.getBoundingClientRect();
    const tooltipWidth = 220; // Approximate tooltip width
    const tooltipHeight = 180; // Approximate tooltip height
    const gap = 12; // Gap between award and tooltip

    // Calculate initial position (centered above the award)
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.top - tooltipHeight - gap + window.scrollY;

    // Clamp horizontal position to stay within viewport
    const minLeft = 16;
    const maxLeft = window.innerWidth - tooltipWidth - 16;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    // If tooltip would go above viewport, show below instead
    if (rect.top - tooltipHeight - gap < 0) {
      top = rect.bottom + gap + window.scrollY;
    }

    setTooltipPosition({ top, left });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    calculatePosition();
  }, [calculatePosition]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // Recalculate position on scroll/resize while hovered
  useEffect(() => {
    if (!isHovered) return;

    const handleUpdate = () => {
      calculatePosition();
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isHovered, calculatePosition]);

  const tooltip =
    isMounted && isHovered && tooltipPosition
      ? createPortal(
          <div
            ref={tooltipRef}
            className={styles.awardTooltipPortal}
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left,
            }}
            aria-hidden="true"
          >
            <Image
              image={award.logo}
              alt=""
              sizes="200px"
              quality={100}
              className={styles.awardTooltipImage}
              loading="lazy"
            />
            {award.name && (
              <span className={styles.awardTooltipName}>{award.name}</span>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={itemRef}
        className={styles.awardItem}
        aria-hidden={isDuplicate}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Image
          image={award.logo}
          alt={award.name || 'Nagroda produktu'}
          sizes="80px"
          quality={90}
          className={styles.awardLogo}
          loading="lazy"
        />
      </div>
      {tooltip}
    </>
  );
}
