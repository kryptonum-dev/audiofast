'use client';

import { getImageProps } from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type SanityRawImage } from '@/components/shared/Image';
import PortableText from '@/components/shared/PortableText';
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

    const desktopImg = current.image as SanityRawImage | undefined;
    const mobileImg = current.mobileImage as SanityRawImage | undefined;

    const desktopSrc = desktopImg?.id
      ? urlFor({ asset: { _ref: desktopImg.id } })
          .fit('crop')
          .auto('format')
          .url()
      : undefined;

    const mobileSrc = mobileImg?.id
      ? urlFor({ asset: { _ref: mobileImg.id } })
          .fit('crop')
          .auto('format')
          .url()
      : undefined;

    const mobileUrl = mobileSrc ?? desktopSrc;
    if (!mobileUrl && !desktopSrc) return undefined;

    const mobile = getImageProps({
      alt: '',
      src: mobileUrl!,
      width: mobileSrc ? 1200 : 1920,
      height: mobileSrc ? 1600 : 1080,
      sizes: '100vw',
    }).props;

    const desktop = desktopSrc
      ? getImageProps({
          alt: '',
          src: desktopSrc,
          width: 1920,
          height: 1080,
          sizes: '100vw',
        }).props
      : undefined;

    return { mobile, desktop };
  }, [current]);

  const previousArt = useMemo(() => {
    if (!previous || !isTransitioning) return undefined;

    const desktopImg = previous.image as SanityRawImage | undefined;
    const mobileImg = previous.mobileImage as SanityRawImage | undefined;

    const desktopSrc = desktopImg?.id
      ? urlFor({ asset: { _ref: desktopImg.id } })
          .fit('crop')
          .auto('format')
          .url()
      : undefined;

    const mobileSrc = mobileImg?.id
      ? urlFor({ asset: { _ref: mobileImg.id } })
          .fit('crop')
          .auto('format')
          .url()
      : undefined;

    const mobileUrl = mobileSrc ?? desktopSrc;
    if (!mobileUrl && !desktopSrc) return undefined;

    const mobile = getImageProps({
      alt: '',
      src: mobileUrl!,
      width: mobileSrc ? 1200 : 1920,
      height: mobileSrc ? 1600 : 1080,
      sizes: '100vw',
    }).props;

    const desktop = desktopSrc
      ? getImageProps({
          alt: '',
          src: desktopSrc,
          width: 1920,
          height: 1080,
          sizes: '100vw',
        }).props
      : undefined;

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
              {previousArt.desktop?.srcSet ? (
                <source
                  media="(min-width: 48em)"
                  srcSet={previousArt.desktop.srcSet}
                  sizes={previousArt.desktop.sizes}
                />
              ) : null}
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
              {currentArt.desktop?.srcSet ? (
                <source
                  media="(min-width: 48em)"
                  srcSet={currentArt.desktop.srcSet}
                  sizes={currentArt.desktop.sizes}
                />
              ) : null}
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
