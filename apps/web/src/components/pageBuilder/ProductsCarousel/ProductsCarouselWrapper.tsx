'use client';

import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from 'embla-carousel-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { PagebuilderType } from '@/src/global/types';

import ArrowButton from '../../ui/ArrowButton';
import ProductCard from '../../ui/ProductCard';
import styles from './styles.module.scss';

interface ProductsCarouselWrapperProps {
  products: PagebuilderType<'productsCarousel'>['products'];
  index: number;
}

export default function ProductsCarouselWrapper({
  products,
  index,
}: ProductsCarouselWrapperProps) {
  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);
  const [canScroll, setCanScroll] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Duplicate items when there are 4 or 5 products for smoother carousel
  const displayProducts = (() => {
    const count = products?.length || 0;
    if (count === 4 || count === 5) {
      return [...products!, ...products!];
    }
    return products!;
  })();

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    skipSnaps: false,
    watchDrag: canScroll,
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback((api: NonNullable<UseEmblaCarouselType[1]>) => {
    setPrevBtnDisabled(!api.canScrollPrev());
    setNextBtnDisabled(!api.canScrollNext());
  }, []);

  // Check if content overflows container
  useEffect(() => {
    const checkOverflow = () => {
      if (viewportRef.current && containerRef.current) {
        const viewportWidth = viewportRef.current.offsetWidth;
        const containerWidth = containerRef.current.scrollWidth;
        setCanScroll(containerWidth > viewportWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);

    return () => {
      window.removeEventListener('resize', checkOverflow);
    };
  }, [displayProducts]);

  useEffect(() => {
    if (!emblaApi) return;

    onSelect(emblaApi);
    emblaApi.on('reInit', onSelect);
    emblaApi.on('select', onSelect);

    return () => {
      emblaApi.off('reInit', onSelect);
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Reinitialize Embla when canScroll changes
  useEffect(() => {
    if (emblaApi && canScroll) {
      emblaApi.reInit();
    }
  }, [canScroll, emblaApi]);

  return (
    <div className={styles.carousel} data-carousel-enabled={canScroll}>
      <div
        className={styles.viewport}
        ref={(node) => {
          viewportRef.current = node;
          if (canScroll) {
            emblaRef(node);
          }
        }}
      >
        <div className={styles.container} ref={containerRef}>
          {displayProducts.map((product, idx) => (
            <ProductCard
              imageSizes="(max-width: 72rem) 222px, 279px"
              priority={index === 0 && idx === 0}
              loading={index === 0 ? 'eager' : 'lazy'}
              key={`${product._id || idx}-${idx}`}
              product={product}
              layout="vertical"
              headingLevel={index === 0 ? 'h2' : 'h3'}
            />
          ))}
        </div>
      </div>
      {canScroll && (
        <div className={styles.buttons}>
          <ArrowButton
            direction="prev"
            onClick={scrollPrev}
            disabled={prevBtnDisabled}
            variant="filled"
            size="md"
          />
          <ArrowButton
            direction="next"
            onClick={scrollNext}
            disabled={nextBtnDisabled}
            variant="filled"
            size="md"
          />
        </div>
      )}
    </div>
  );
}

