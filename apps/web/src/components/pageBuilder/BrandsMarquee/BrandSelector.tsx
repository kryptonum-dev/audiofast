'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PagebuilderType, PortableTextValue } from '@/global/types';

import PortableText from '../../shared/PortableText';
import Button from '../../ui/Button';
import BrandMarqueeList from './BrandMarqueeList';
import styles from './styles.module.scss';

type BrandSelectorProps = PagebuilderType<'brandsMarquee'> & {
  headingLevelOffset: number;
};

type BrandType = NonNullable<BrandSelectorProps['topBrands']>[number];

type HeaderState = {
  heading: PortableTextValue;
  description: PortableTextValue;
  buttonText: string;
  buttonHref?: string | null;
};

const HOVER_TIMEOUT_MS = 2000;

export default function BrandSelector({
  topBrands,
  button,
  bottomBrands,
  heading,
  description,
  headingLevelOffset,
}: BrandSelectorProps) {
  const [currentHeader, setCurrentHeader] = useState<HeaderState>({
    heading: heading!,
    description: description!,
    buttonText: button?.text || '',
    buttonHref: button?.href,
  });

  const [animationKey, setAnimationKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShowingBrandRef = useRef(false);
  const isInteractingRef = useRef(false);
  const currentBrandRef = useRef<string | null>(null);

  const defaultHeader = useMemo(
    () => ({
      heading: heading!,
      description: description!,
      buttonText: button?.text || '',
      buttonHref: button?.href,
    }),
    [heading, description, button?.text, button?.href]
  );

  const clearHoverTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetToDefault = useCallback(() => {
    setCurrentHeader(defaultHeader);
    setAnimationKey((prev) => prev + 1);
    isShowingBrandRef.current = false;
    currentBrandRef.current = null;
  }, [defaultHeader]);

  const startResetTimerIfNeeded = useCallback(() => {
    if (isShowingBrandRef.current && !isInteractingRef.current) {
      clearHoverTimeout();
      timeoutRef.current = setTimeout(() => {
        resetToDefault();
      }, HOVER_TIMEOUT_MS);
    }
  }, [clearHoverTimeout, resetToDefault]);

  const handleInteractionStart = useCallback(() => {
    isInteractingRef.current = true;
    clearHoverTimeout();
  }, [clearHoverTimeout]);

  const handleInteractionEnd = useCallback(() => {
    isInteractingRef.current = false;
    // Start reset timer after a short delay to allow for moving between areas
    setTimeout(() => {
      startResetTimerIfNeeded();
    }, 100);
  }, [startResetTimerIfNeeded]);

  const handleBrandHover = useCallback(
    (brand: BrandType) => {
      if (!brand?.name || !brand?.description) return;

      // Don't re-animate if it's the same brand
      const isSameBrand = currentBrandRef.current === brand.slug;

      clearHoverTimeout();

      // Create brand-specific header state
      const brandHeader: HeaderState = {
        heading: [
          {
            _type: 'block',
            _key: 'brand-heading',
            style: 'normal',
            markDefs: [],
            children: [
              {
                _type: 'span',
                _key: 'brand-span',
                text: brand.name,
                marks: [],
              },
            ],
          },
        ],
        description: brand.description,
        buttonText: 'Sprawdź markę',
        buttonHref: brand.slug,
      };

      setCurrentHeader(brandHeader);

      // Only trigger animation if it's a different brand
      if (!isSameBrand) {
        setAnimationKey((prev) => prev + 1);
      }

      isShowingBrandRef.current = true;
      currentBrandRef.current = brand.slug;

      // Start timer - this will be cleared if user starts interacting with header
      clearHoverTimeout();
      timeoutRef.current = setTimeout(() => {
        // Double-check we're not interacting before resetting
        if (!isInteractingRef.current) {
          resetToDefault();
        }
      }, HOVER_TIMEOUT_MS);
    },
    [clearHoverTimeout, resetToDefault]
  );

  const handleBrandLeave = useCallback(() => {
    // Don't immediately reset on leave, let the timeout handle it
  }, []);

  useEffect(() => {
    return () => {
      clearHoverTimeout();
    };
  }, [clearHoverTimeout]);

  return (
    <>
      <header
        className={styles.header}
        key={animationKey}
        onMouseEnter={handleInteractionStart}
        onMouseLeave={handleInteractionEnd}
        onFocus={handleInteractionStart}
        onBlur={handleInteractionEnd}
      >
        <PortableText
          value={currentHeader.heading}
          className={styles.heading}
          headingLevel={headingLevelOffset === 0 ? 'h1' : 'h2'}
        />
        <PortableText
          value={currentHeader.description}
          className={styles.description}
          enablePortableTextStyles
        />
        <Button
          text={currentHeader.buttonText}
          href={currentHeader.buttonHref}
          variant="secondary"
        />
      </header>
      <div className={styles.marquees}>
        <BrandMarqueeList
          brands={topBrands!}
          direction="normal"
          onBrandHover={handleBrandHover}
          onBrandLeave={handleBrandLeave}
          onBrandInteractionStart={handleInteractionStart}
          onBrandInteractionEnd={handleInteractionEnd}
        />
        <BrandMarqueeList
          brands={bottomBrands!}
          direction="reverse"
          onBrandHover={handleBrandHover}
          onBrandLeave={handleBrandLeave}
          onBrandInteractionStart={handleInteractionStart}
          onBrandInteractionEnd={handleInteractionEnd}
        />
      </div>
    </>
  );
}
