'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SanityRawImage } from '@/components/shared/Image';
import Image from '@/components/shared/Image';

import ArrowButton from '../../ui/ArrowButton';
import styles from './styles.module.scss';

interface ProductHeroGalleryProps {
  images: SanityRawImage[];
}

export default function ProductHeroGallery({
  images,
}: ProductHeroGalleryProps) {
  const [active, setActive] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const thumbsContainerRef = useRef<HTMLDivElement>(null);
  const thumbsSlidesRef = useRef<HTMLDivElement>(null);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [emblaThumbsRef, emblaThumbsApi] = useEmblaCarousel({
    loop: false,
    align: 'start',
    skipSnaps: false,
    watchDrag: canScroll,
  });

  const currentImage = images[active];

  const triggerAnimation = useCallback(() => {
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    setIsAnimating(true);
    animationTimerRef.current = setTimeout(() => setIsAnimating(false), 800);
  }, []);

  const navigate = useCallback(
    (dir: -1 | 1) => {
      setActive((prev) => {
        if (dir === 1) {
          return prev === images.length - 1 ? 0 : prev + 1;
        }
        return prev === 0 ? images.length - 1 : prev - 1;
      });
      triggerAnimation();
    },
    [images.length, triggerAnimation]
  );

  const onThumbClick = useCallback(
    (index: number) => {
      if (index !== active) {
        setActive(index);
        triggerAnimation();
      }
    },
    [active, triggerAnimation]
  );

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

  // Sync thumbnail carousel with selected index
  useEffect(() => {
    if (emblaThumbsApi && canScroll) {
      emblaThumbsApi.scrollTo(active);
    }
  }, [active, emblaThumbsApi, canScroll]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, []);

  return (
    <div className={styles.gallery}>
      <div className={styles.mainImage} data-animating={isAnimating}>
        <Image
          key={active}
          image={currentImage}
          sizes="(max-width: 85.375rem) 48vw, 651px"
          priority={active === 0}
          alt={currentImage?.alt || `Zdjęcie produktu ${active + 1}`}
        />
        {images.length > 1 && (
          <div className={styles.mainControls}>
            <ArrowButton
              direction="prev"
              onClick={() => navigate(-1)}
              ariaLabel="Poprzednie zdjęcie"
              variant="ghost"
              outline="light"
            />
            <ArrowButton
              direction="next"
              onClick={() => navigate(1)}
              ariaLabel="Następne zdjęcie"
              variant="ghost"
              outline="light"
            />
          </div>
        )}
      </div>
      {images.length > 1 && (
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
              {images.map((img, i) => (
                <button
                  key={i}
                  className={styles.thumb}
                  data-active={i === active}
                  onClick={() => onThumbClick(i)}
                  type="button"
                  aria-label={`Przejdź do zdjęcia ${i + 1}`}
                >
                  <Image image={img} sizes="176px" alt="" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
