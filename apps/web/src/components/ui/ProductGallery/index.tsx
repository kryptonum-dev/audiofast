'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SanityRawImage } from '../../shared/Image';
import Image from '../../shared/Image';
import ArrowButton from '../ArrowButton';
import styles from './styles.module.scss';

interface ProductGalleryProps {
  images: SanityRawImage[];
  className?: string;
}

export default function ProductGallery({
  images,
  className,
}: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const thumbsContainerRef = useRef<HTMLDivElement>(null);
  const thumbsSlidesRef = useRef<HTMLDivElement>(null);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [emblaThumbsRef, emblaThumbsApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    skipSnaps: false,
    watchDrag: canScroll,
  });

  const triggerAnimation = useCallback(() => {
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
    }
    setIsAnimating(true);
    animationTimerRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, 800);
  }, []);

  const onThumbClick = useCallback(
    (index: number) => {
      if (index !== selectedIndex) {
        setSelectedIndex(index);
        triggerAnimation();
      }
    },
    [selectedIndex, triggerAnimation]
  );

  const scrollPrev = useCallback(() => {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    triggerAnimation();
  }, [images.length, triggerAnimation]);

  const scrollNext = useCallback(() => {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    triggerAnimation();
  }, [images.length, triggerAnimation]);

  // Check if thumbnails overflow
  useEffect(() => {
    const checkOverflow = () => {
      if (thumbsContainerRef.current && thumbsSlidesRef.current) {
        const containerWidth = thumbsContainerRef.current.offsetWidth;
        const slidesWidth = thumbsSlidesRef.current.scrollWidth;
        setCanScroll(slidesWidth > containerWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [images]);

  // Sync thumbnail carousel with selected index (only if scrollable)
  useEffect(() => {
    if (emblaThumbsApi && canScroll) {
      emblaThumbsApi.scrollTo(selectedIndex);
    }
  }, [selectedIndex, emblaThumbsApi, canScroll]);

  // Cleanup animation timer on unmount
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  if (!images || images.length === 0) return null;

  return (
    <section className={`${styles.gallery} ${className}`}>
      <div className={styles.mainContainer} data-animating={isAnimating}>
        <Image
          key={selectedIndex}
          image={images[selectedIndex]}
          sizes="(max-width: 37.4375rem) 96vw, (max-width: 56.1875rem) 84vw, (max-width: 85.375rem) 96vw, 1302px"
          loading="lazy"
        />
        <div className={styles.mainControls}>
          <ArrowButton
            direction="prev"
            onClick={scrollPrev}
            ariaLabel="Poprzednie zdjęcie"
            variant="ghost"
            outline="light"
          />
          <ArrowButton
            direction="next"
            onClick={scrollNext}
            ariaLabel="Następne zdjęcie"
            variant="ghost"
            outline="light"
          />
        </div>
      </div>
      <div
        className={styles.thumbsContainer}
        ref={thumbsContainerRef}
        data-can-scroll={canScroll}
      >
        <div
          className={styles.thumbsViewport}
          ref={canScroll ? emblaThumbsRef : null}
        >
          <div className={styles.thumbsSlides} ref={thumbsSlidesRef}>
            {[...images].map((image, index) => (
              <button
                key={index}
                onClick={() => onThumbClick(index)}
                className={styles.thumbSlide}
                data-active={index === selectedIndex}
                type="button"
                aria-label={`Przejdź do zdjęcia ${index + 1}`}
              >
                <Image
                  image={image}
                  sizes="(max-width: 37.4375rem) 84px, (max-width: 56.1875rem) 127px, 156px"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
