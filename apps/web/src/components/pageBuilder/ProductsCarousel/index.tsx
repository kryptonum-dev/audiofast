import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../portableText';
import Button from '../../ui/Button';
import ProductsCarouselWrapper from './ProductsCarouselWrapper';
import styles from './styles.module.scss';

type ProductsCarouselProps = PagebuilderType<'productsCarousel'> & {
  index: number;
  customId?: string;
};

export default function ProductsCarousel({
  customId,
  heading,
  description,
  button,
  products,
  index,
}: ProductsCarouselProps) {
  if (!products || products.length === 0) return null;

  return (
    <section
      id={customId}
      className={`${styles.productsCarousel} max-width-block`}
    >
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
          className={styles.heading}
        />
        {description && (
          <PortableText
            value={description}
            enablePortableTextStyles
            className={styles.description}
          />
        )}
        {button && <Button {...button} />}
      </header>
      <ProductsCarouselWrapper products={products} index={index} />
    </section>
  );
}

