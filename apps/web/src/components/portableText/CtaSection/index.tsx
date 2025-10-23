import type { PortableTextTypeComponentProps } from '@portabletext/react';

import ProductCard from '@/src/components/ui/ProductCard';
import type { PortableTextProps } from '@/src/global/types';

import Button from '../../ui/Button';
import styles from './styles.module.scss';

type CtaSectionValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptCtaSection';
  showProducts?: boolean;
};

export function CtaSectionComponent({
  value,
}: PortableTextTypeComponentProps<CtaSectionValue>) {
  const { heading, button, products, showProducts } = value;
  return (
    <section className={styles.wrapper}>
      {showProducts && products && products.length > 0 && (
        <div className={styles.products}>
          {products.map((product) => (
            <ProductCard
              product={product}
              showButton={false}
              isClient={false}
              headingLevel="h3"
              key={product._id}
              imageSizes="(max-width: 27.4375rem) 96vw, (max-width: 37.4375rem) 46vw, (max-width: 56.125rem) 42vw, (max-width: 69.3125rem) 374px, 342px"
            />
          ))}
        </div>
      )}
      <div className={styles.content}>
        <Button variant="secondary" {...button} />
        <h2 className={styles.heading}>{heading}</h2>
      </div>
    </section>
  );
}
