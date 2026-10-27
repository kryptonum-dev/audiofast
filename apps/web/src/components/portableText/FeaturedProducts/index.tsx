import type { PortableTextTypeComponentProps } from '@portabletext/react';

import ProductCard from '@/src/components/ui/ProductCard';
import {
  dataSanity,
  type ScopedDataAttribute,
} from '@/src/global/sanity/data-attribute';
import type { PortableTextProps } from '@/src/global/types';

import styles from './styles.module.scss';

type FeaturedProductsValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptFeaturedProducts';
};

export function FeaturedProductsComponent({
  value,
  dataAttribute,
}: PortableTextTypeComponentProps<FeaturedProductsValue> & {
  /** Draft only: scoped to this block (`<field>[_key==…]`); `products[]` is draggable. */
  dataAttribute?: ScopedDataAttribute;
}) {
  const { products } = value;
  return (
    <section className={styles.wrapper}>
      {products!.map((product) => (
        <ProductCard
          product={product}
          layout="vertical"
          headingLevel="h3"
          key={product._id}
          dataSanity={dataSanity(dataAttribute, [
            'products',
            { _key: product._key },
          ])}
          imageSizes="(max-width: 27.4375rem) 96vw, (max-width: 37.4375rem) 46vw, (max-width: 56.125rem) 42vw, (max-width: 69.3125rem) 374px, 342px"
        />
      ))}
    </section>
  );
}
