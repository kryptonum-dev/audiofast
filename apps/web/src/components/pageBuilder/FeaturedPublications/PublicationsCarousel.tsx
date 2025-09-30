'use client';

import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from 'embla-carousel-react';
import { useCallback, useEffect, useState } from 'react';

import ArrowButton from '../../ui/ArrowButton';
import type { PublicationType } from '../../ui/PublicationCard';
import PublicationCard from '../../ui/PublicationCard';
import styles from './styles.module.scss';

interface PublicationsCarouselProps {
  publications: PublicationType[];
  index: number;
}

export default function PublicationsCarousel({
  publications,
  index,
}: PublicationsCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    skipSnaps: false,
  });

  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);

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

  useEffect(() => {
    if (!emblaApi) return;

    onSelect(emblaApi);
    emblaApi.on('reInit', onSelect);
    emblaApi.on('select', onSelect);
  }, [emblaApi, onSelect]);

  return (
    <div className={styles.carousel}>
      <div className={styles.viewport} ref={emblaRef}>
        <div className={styles.container}>
          {publications.map((publication) => (
            <PublicationCard
              imageSizes="(max-width: 72rem) 222px, 279px"
              key={publication._id}
              publication={publication}
              layout="horizontal"
              headingLevel={index === 0 ? 'h2' : 'h3'}
            />
          ))}
        </div>
      </div>
      {publications.length > 4 && (
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
