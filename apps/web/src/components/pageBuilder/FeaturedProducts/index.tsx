import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../shared/PortableText';
import Button from '../../ui/Button';
import Carousels from './Carousels';
import styles from './styles.module.scss';

type FeaturedProductsProps = PagebuilderType<'featuredProducts'> & {
  index: number;
};

export default function FeaturedProducts({
  heading,
  description,
  button,
  newProducts,
  bestsellers,
  index,
}: FeaturedProductsProps) {
  return (
    <section className={`${styles.featuredProducts} max-width`}>
      <Carousels
        newProducts={newProducts!}
        bestsellers={bestsellers!}
        index={index}
      >
        <>
          <PortableText
            value={heading}
            headingLevel={index === 0 ? 'h1' : 'h2'}
          />
          <PortableText value={description} enablePortableTextStyles />
          <Button {...button} />
        </>
      </Carousels>
    </section>
  );
}
