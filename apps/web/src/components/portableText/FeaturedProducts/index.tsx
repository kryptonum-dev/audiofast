import type { PortableTextTypeComponentProps } from '@portabletext/react';

import ProductCard from '@/src/components/ui/ProductCard';
import type { PortableTextProps } from '@/src/global/types';

import styles from './styles.module.scss';

type FeaturedProductsValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptFeaturedProducts';
};

export function FeaturedProductsComponent({
  value,
}: PortableTextTypeComponentProps<FeaturedProductsValue>) {
  const { products } = value;
  return (
    <section className={styles.wrapper}>
      {products!.map((product) => (
        <ProductCard
          product={product}
          isClient={false}
          layout="vertical"
          headingLevel="h3"
          key={product._id}
          imageSizes="(max-width: 27.4375rem) 96vw, (max-width: 37.4375rem) 46vw, (max-width: 56.125rem) 42vw, (max-width: 69.3125rem) 374px, 342px"
        />
      ))}
    </section>
  );
}
