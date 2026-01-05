import Link from 'next/link';

import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../portableText';
import Image from '../../shared/Image';
import styles from './styles.module.scss';

type BrandsListProps = PagebuilderType<'brandsList'> & {
  index: number;
};

export default function BrandsList({
  heading,
  description,
  ctaText,
  brands,
  index,
}: BrandsListProps) {
  // Don't render if no brands available
  if (!brands || brands.length === 0) {
    return null;
  }

  return (
    <section className={`${styles.brandsList} max-width-block`}>
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
          className={styles.heading}
        />
        <PortableText
          value={description}
          enablePortableTextStyles
          className={styles.description}
        />
      </header>
      <nav className={styles.brands}>
        {brands?.map((brand, idx) => (
          <Link
            key={brand?._id}
            href={brand?.slug!}
            aria-label={`Przejdź do marki ${brand?.name}`}
            className={styles.brand}
          >
            <Image
              image={brand?.logo}
              alt={brand?.name!}
              sizes="190px"
              loading={index === 0 ? 'eager' : 'lazy'}
              priority={index === 0 && idx === 0}
              quality={90}
            />
          </Link>
        ))}
      </nav>
      {ctaText && (
        <PortableText
          value={ctaText}
          enablePortableTextStyles
          className={styles.ctaText}
        />
      )}
    </section>
  );
}
