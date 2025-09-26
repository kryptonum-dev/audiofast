'use client';

import type { EmblaCarouselType } from 'embla-carousel';
import useEmblaCarousel from 'embla-carousel-react';
import { useEffect } from 'react';

import type { ProductType } from '../../ui/ProductCard';
import ProductCard from '../../ui/ProductCard';
import styles from './styles.module.scss';

interface ProductsCarouselProps {
  products: ProductType[];
  sectionType: 'newProducts' | 'bestsellers';
  onApiChange?: (api: EmblaCarouselType) => void;
}

export default function ProductsCarousel({
  products,
  onApiChange,
}: ProductsCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    skipSnaps: false,
  });

  useEffect(() => {
    if (emblaApi && onApiChange) {
      onApiChange(emblaApi);
    }
  }, [emblaApi, onApiChange]);

  return (
    <div className={styles.viewport} ref={emblaRef}>
      <div className={styles.container}>
        {products.map((product) => (
          <ProductCard
            imageSizes="(max-width: 27.4375rem) 286px, (max-width: 43.6875rem) 334px, (max-width: 56.1875rem) 41vw, (max-width: 69.9375rem) 300px, 405px"
            key={product._id}
            product={product}
            headingLevel="h3"
            showButton={false}
          />
        ))}
      </div>
    </div>
  );
}
