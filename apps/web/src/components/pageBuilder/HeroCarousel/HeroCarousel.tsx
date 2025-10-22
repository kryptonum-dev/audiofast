'use client';

import { getImageProps } from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type SanityRawImage } from '@/components/shared/Image';
import PortableText from '@/src/components/portableText';
import ArrowButton from '@/components/ui/ArrowButton';
import Button from '@/components/ui/Button';
import PaginationDots from '@/components/ui/PaginationDots';
import { urlFor } from '@/global/sanity/client';
import type { PagebuilderType } from '@/global/types';

import styles from './styles.module.scss';

export type HeroCarouselProps = Pick<
  PagebuilderType<'heroCarousel'>,
  'slides'
> & {
  index: number;
};

const HERO_AUTOPLAY_INTERVAL_MS = 8000;

export default function HeroCarousel({ slides, index }: HeroCarouselProps) {
  const count = slides?.length ?? 0;
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const reducedMotion = useMemo(() => {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }, []);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  const scheduleTransitionEnd = useCallback(
    (ms = 800) => {
      clearTransitionTimer();
      transitionTimerRef.current = setTimeout(
        () => setIsTransitioning(false),
        ms
      );
    },
    [clearTransitionTimer]
  );

  const beginTransition = useCallback(() => {
    // Start a fresh transition window
    setIsTransitioning(true);
    scheduleTransitionEnd(800);
  }, [scheduleTransitionEnd]);

  const restartTransition = useCallback(() => {
    // Force animation restart by toggling the data attribute
    clearTransitionTimer();
    setIsTransitioning(false);
    requestAnimationFrame(() => {
      setIsTransitioning(true);
      scheduleTransitionEnd(800);
    });
  }, [clearTransitionTimer, scheduleTransitionEnd]);

  const goTo = useCallback(
    (index: number) => {
      if (!count) return;
      const newIndex = ((index % count) + count) % count;
      if (newIndex === activeIndex) return;

      setPreviousIndex(activeIndex);
      setActiveIndex(newIndex);

      if (isTransitioning) {
        restartTransition();
      } else {
        beginTransition();
      }
    },
    [count, activeIndex, isTransitioning, beginTransition, restartTransition]
  );

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (reducedMotion || isHovered || !count || isTransitioning) return;
    clearTimer();
    timerRef.current = setInterval(() => {
      setActiveIndex((idx) => {
        const newIdx = (idx + 1) % count;
        setPreviousIndex(idx);
        return newIdx;
      });
      beginTransition();
    }, HERO_AUTOPLAY_INTERVAL_MS);
  }, [
    clearTimer,
    count,
    isHovered,
    reducedMotion,
    isTransitioning,
    beginTransition,
  ]);

  // Start / restart timer when dependencies change
  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer, activeIndex]);

  // Pause on tab hide
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        clearTimer();
      } else {
        startTimer();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [startTimer, clearTimer]);

  // Cleanup transition timer on unmount
  useEffect(() => {
    return () => {
      clearTransitionTimer();
    };
  }, [clearTransitionTimer]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!count) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        clearTimer();
        prev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        clearTimer();
        next();
      }
    },
    [clearTimer, count, next, prev]
  );

  const current = count ? slides![activeIndex] : undefined;
  const previous = count ? slides![previousIndex] : undefined;

  // Build URLs for current and previous slides for smooth crossfading
  const currentArt = useMemo(() => {
    if (!current) return undefined;

    const img = current.image as SanityRawImage | undefined;
    if (!img?.id) return undefined;

    // Convert to Sanity image source format
    const sanitySource = {
      asset: { _ref: img.id },
      ...(img.hotspot && { hotspot: img.hotspot }),
      ...(img.crop && { crop: img.crop }),
    };

    // Desktop: 21:9 aspect ratio (e.g., 1920x823)
    const desktopSrc = urlFor(sanitySource)
      .width(2120)
      .height(823)
      .fit('crop')
      .auto('format')
      .url();

    // Mobile: 3:4 aspect ratio (e.g., 600x800)
    const mobileSrc = urlFor(sanitySource)
      .width(600)
      .height(800)
      .fit('crop')
      .auto('format')
      .url();

    const mobile = getImageProps({
      alt: '',
      src: mobileSrc,
      width: 600,
      height: 800,
      sizes: '(min-width: 85.375rem) 1366px, 100vw',
      priority: index === 0,
    }).props;

    const desktop = getImageProps({
      alt: '',
      src: desktopSrc,
      width: 1302,
      height: 556,
      sizes: '(min-width: 85.375rem) 1366px, 100vw',
      priority: index === 0,
    }).props;

    return { mobile, desktop };
  }, [current, index]);

  const previousArt = useMemo(() => {
    if (!previous || !isTransitioning) return undefined;

    const img = previous.image as SanityRawImage | undefined;
    if (!img?.id) return undefined;

    // Convert to Sanity image source format
    const sanitySource = {
      asset: { _ref: img.id },
      ...(img.hotspot && { hotspot: img.hotspot }),
      ...(img.crop && { crop: img.crop }),
    };

    // Desktop: 21:9 aspect ratio (e.g., 1920x823)
    const desktopSrc = urlFor(sanitySource)
      .width(2120)
      .height(823)
      .fit('crop')
      .auto('format')
      .url();

    // Mobile: 3:4 aspect ratio (e.g., 600x800)
    const mobileSrc = urlFor(sanitySource)
      .width(600)
      .height(800)
      .fit('crop')
      .auto('format')
      .url();

    const mobile = getImageProps({
      alt: '',
      src: mobileSrc,
      width: 600,
      height: 800,
      sizes: '(min-width: 85.375rem) 1366px, 100vw',
    }).props;

    const desktop = getImageProps({
      alt: '',
      src: desktopSrc,
      width: 1302,
      height: 556,
      sizes: '(min-width: 85.375rem) 1366px, 100vw',
    }).props;

    return { mobile, desktop };
  }, [previous, isTransitioning]);

  return (
    <div
      className={styles.carousel}
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={styles.bg}
        aria-hidden
        data-transitioning={isTransitioning}
      >
        {/* Previous image for crossfade transition */}
        {previousArt && (
          <div className={styles.bgLayer} data-layer="previous">
            <picture>
              <source
                media="(min-width: 37.5rem)"
                srcSet={previousArt.desktop.srcSet}
                sizes={previousArt.desktop.sizes}
              />
              {
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  {...previousArt.mobile}
                  alt=""
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              }
            </picture>
          </div>
        )}

        {/* Current image */}
        {currentArt && (
          <div className={styles.bgLayer} data-layer="current">
            <picture>
              <source
                media="(min-width: 37.5rem)"
                srcSet={currentArt.desktop.srcSet}
                sizes={currentArt.desktop.sizes}
              />
              {
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  {...currentArt.mobile}
                  alt=""
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              }
            </picture>
          </div>
        )}

        <div className={styles.overlay} />
      </div>

      <div
        className={styles.content}
        aria-live="polite"
        data-transitioning={isTransitioning}
      >
        {slides?.map((slide, i) => {
          const isActive = i === activeIndex;
          const isPrevious = i === previousIndex && isTransitioning;
          return (
            <header
              key={i}
              className={styles.slide}
              data-active={isActive}
              data-previous={isPrevious}
              data-transitioning={isTransitioning}
              aria-hidden={!isActive}
            >
              <div className={styles.slideContent}>
                <PortableText
                  value={slide.title!}
                  className={`${styles.title} ${styles.animateElement}`}
                  headingLevel={
                    index === 0
                      ? i === 0
                        ? 'h1'
                        : 'h2'
                      : i === 0
                        ? 'h2'
                        : 'h3'
                  }
                />
                <PortableText
                  value={slide.description!}
                  className={`${styles.description} ${styles.animateElement}`}
                />
                <Button
                  {...slide.button!}
                  className={`${styles.cta} ${styles.animateElement}`}
                  tabIndex={isActive ? 0 : -1}
                />
              </div>
            </header>
          );
        })}
      </div>
      <nav className={styles.controls}>
        <ArrowButton
          direction="prev"
          ariaLabel="Previous slide"
          variant="ghost"
          size="sm"
          outline="light"
          onClick={() => {
            clearTimer();
            prev();
          }}
        />
        <PaginationDots
          count={count}
          activeIndex={activeIndex}
          onSelect={(i) => {
            clearTimer();
            goTo(i);
          }}
          outline="light"
        />
        <ArrowButton
          direction="next"
          ariaLabel="Next slide"
          variant="ghost"
          size="sm"
          outline="light"
          onClick={() => {
            clearTimer();
            next();
          }}
        />
      </nav>
    </div>
  );
}
