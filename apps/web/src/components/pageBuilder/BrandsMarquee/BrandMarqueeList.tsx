import Link from 'next/link';

import AppImage from '@/components/shared/Image';
import type { PagebuilderType } from '@/src/global/types';

import styles from './styles.module.scss';

type BrandSelectorProps = PagebuilderType<'brandsMarquee'>;
type BrandType = NonNullable<BrandSelectorProps['topBrands']>[number];

interface BrandMarqueeListProps {
  brands: BrandType[];
  direction: 'normal' | 'reverse';
  onBrandHover: (brand: BrandType) => void;
  onBrandLeave: () => void;
  onBrandInteractionStart?: () => void;
  onBrandInteractionEnd?: () => void;
}

export default function BrandMarqueeList({
  brands,
  direction,
  onBrandHover,
  onBrandLeave,
  onBrandInteractionStart,
  onBrandInteractionEnd,
}: BrandMarqueeListProps) {
  // Duplicate brands for seamless loop
  const duplicatedBrands = [...brands, ...brands];

  return (
    <div className={styles.marqueeContainer} data-direction={direction}>
      <div className={styles.marqueeTrack}>
        <div className={styles.marqueeList}>
          {duplicatedBrands.map((brand, idx) => {
            const key = `${brand?.slug || 'brand'}-${idx}`;
            const isDuplicate = idx >= brands.length;

            return (
              <Link
                key={key}
                className={styles.brandItem}
                href={brand.slug!}
                aria-label={`Przejdź do marki ${brand.name}`}
                aria-hidden={isDuplicate}
                tabIndex={isDuplicate ? -1 : 0}
                onMouseEnter={() => {
                  onBrandHover(brand);
                  onBrandInteractionStart?.();
                }}
                onMouseLeave={() => {
                  onBrandLeave();
                  onBrandInteractionEnd?.();
                }}
                onFocus={() => {
                  onBrandHover(brand);
                  onBrandInteractionStart?.();
                }}
                onBlur={() => {
                  onBrandLeave();
                  onBrandInteractionEnd?.();
                }}
              >
                <AppImage
                  image={brand.logo}
                  alt={brand.name || 'Logo marki'}
                  sizes="121px"
                  quality={90}
                  className={styles.brandLogo}
                  priority={!isDuplicate && idx < 6}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
