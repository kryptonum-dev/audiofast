import type { SanityRawImage } from '@/components/shared/Image';
import Image from '@/components/shared/Image';
import type { PortableTextProps } from '@/src/global/types';

import PortableText from '../../portableText';
import ProductHeroButtons from './ProductHeroButtons';
import ProductHeroGallery from './ProductHeroGallery';
import styles from './styles.module.scss';

export type AwardType = {
  _id: string;
  name: string;
  logo?: SanityRawImage | null;
};

export interface ProductHeroProps {
  name: string;
  subtitle: string;
  brand?: {
    name: string;
    slug: string;
    logo?: SanityRawImage | null;
  };
  price?: number | null;
  imageGallery: SanityRawImage[];
  shortDescription?: PortableTextProps;
  awards?: AwardType[];
  customId?: string;
}

export default function ProductHero({
  name,
  subtitle,
  brand,
  price,
  imageGallery,
  shortDescription,
  awards,
  customId,
}: ProductHeroProps) {
  // Format price for display
  const formatPrice = (price: number | null | undefined) => {
    if (!price) return 'Cena na zapytanie';
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <section className={`${styles.productHero} max-width`} id={customId}>
      <div className={styles.container}>
        {/* Image Gallery Section */}
        <div className={styles.gallerySection}>
          {imageGallery && imageGallery.length > 0 ? (
            <ProductHeroGallery images={imageGallery} />
          ) : (
            <div className={styles.mainImage}>
              <div className={styles.placeholder}>Brak zdjęcia</div>
            </div>
          )}
        </div>

        {/* Product Information Section */}
        <div className={styles.infoSection}>
          {/* Brand Logo */}
          {brand?.logo && (
            <div className={styles.brandLogo}>
              <Image
                image={brand.logo}
                sizes="(max-width: 56.1875rem) 96px, 128px"
                loading="lazy"
              />
            </div>
          )}

          {/* Product Title */}
          <div className={styles.productTitle}>
            {brand?.name && (
              <span className={styles.brandName}>{brand.name}</span>
            )}
            <h1 className={styles.productName}>{name}</h1>
          </div>

          {/* Subtitle */}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

          {/* Price */}
          {price !== undefined && (
            <div className={styles.priceWrapper}>
              <span className={styles.price}>{formatPrice(price)}</span>
            </div>
          )}

          {/* Awards */}
          {awards && awards.length > 0 && (
            <div className={styles.awardsWrapper}>
              {awards.map((award) => (
                <div key={award._id} className={styles.award}>
                  {award.logo ? (
                    <Image
                      image={award.logo}
                      sizes="48px"
                      alt={award.name}
                      loading="lazy"
                    />
                  ) : (
                    <span className={styles.awardPlaceholder}>
                      {award.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Short Description */}
          {shortDescription && (
            <div className={styles.description}>
              <PortableText value={shortDescription} enablePortableTextStyles />
            </div>
          )}

          {/* CTA Buttons */}
          <ProductHeroButtons className={styles.buttons} />
        </div>
      </div>
    </section>
  );
}
