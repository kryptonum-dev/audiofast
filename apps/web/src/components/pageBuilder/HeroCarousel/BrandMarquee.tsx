import Link from 'next/link';

import AppImage from '@/components/shared/Image';
import type { PagebuilderType } from '@/global/types';

import styles from './styles.module.scss';

export type BrandMarqueeProps = Pick<PagebuilderType<'heroCarousel'>, 'brands'>;

export default function BrandMarquee({ brands }: BrandMarqueeProps) {
  if (!brands || brands.length === 0) {
    return null;
  }

  const duplicatedBrands = [...brands, ...brands];

  return (
    <div className={styles.brands} aria-label="Nasze marki">
      <div className={styles.track}>
        <nav className={styles.brandList}>
          {duplicatedBrands.map((brand, idx) => {
            const key = `${brand?.slug || 'brand'}-${idx}`;
            const isDuplicate = idx >= brands.length;

            if (!brand?.logo) {
              return null;
            }

            return (
              <Link
                key={key}
                className={styles.brandItem}
                aria-hidden={isDuplicate}
                href={brand.slug!}
                aria-label={`Przejdź do marki ${brand.name}`}
                tabIndex={isDuplicate ? -1 : 0}
              >
                <AppImage
                  image={brand.logo}
                  alt={brand.name || 'Logo marki'}
                  sizes="(max-width: 56.1875rem) 72px, 93px"
                  quality={80}
                  className={styles.brandLogo}
                  priority={!isDuplicate && idx < 6}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
