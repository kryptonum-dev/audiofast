import type { SanityRawImage } from '@/components/shared/Image';
import Image from '@/components/shared/Image';
import type { CompletePricingData } from '@/src/global/supabase/types';
import type { BrandType, PortableTextProps } from '@/src/global/types';

import Button from '../../ui/Button';
import AddToComparison from './AddToComparison';
import PricingConfigurator from './PricingConfigurator';
import ProductDescription from './ProductDescription';
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
  brand?: BrandType;
  pricingData?: CompletePricingData | null;
  imageGallery: SanityRawImage[];
  shortDescription?: PortableTextProps;
  awards?: AwardType[];
  customId?: string;
  productId?: string;
  categorySlug?: string;
}

export default function ProductHero({
  name,
  subtitle,
  brand,
  pricingData,
  imageGallery,
  shortDescription,
  awards,
  customId,
  productId,
  categorySlug,
}: ProductHeroProps) {
  // Format price for display (converting cents to PLN)

  // Prepare awards for display
  const shouldUseMarquee = awards && awards.length >= 8;
  const displayAwards = shouldUseMarquee ? [...awards, ...awards] : awards;

  // Calculate animation duration based on number of items
  // Base: 2s per item, min 15s, max 45s
  const getAnimationDuration = () => {
    if (!shouldUseMarquee || !awards) return 30;
    const duration = awards.length * 2;
    return Math.max(15, Math.min(45, duration));
  };

  const animationDuration = getAnimationDuration();

  return (
    <section className={`${styles.productHero} max-width`} id={customId}>
      <ProductHeroGallery images={imageGallery} />
      <header className={styles.header}>
        <div className={styles.brandLogo}>
          <Image
            image={brand!.logo}
            sizes="(max-width: 56.1875rem) 96px, 128px"
            loading="lazy"
          />
        </div>
        <span className={styles.prefix}>{subtitle}</span>
        <h1 className={styles.heading}>
          <span className={styles.brandName}>{brand!.name}</span>
          <span className={styles.productName}>{name}</span>
        </h1>
      </header>
      <ProductDescription shortDescription={shortDescription!} />
      <div className={styles.priceWrapper}>
        {pricingData ? (
          <PricingConfigurator pricingData={pricingData} />
        ) : (
          <span className={styles.price}>Brak ceny</span>
        )}

        <Button
          text="Zapytaj o produkt"
          variant="primary"
          href="/kontakt/"
          iconUsed="information"
        />
        <AddToComparison
          productId={productId}
          categorySlug={categorySlug}
          productName={name}
          productData={{
            _id: productId,
            name,
            brand,
            mainImage: imageGallery[0],
          }}
        />
      </div>
      {displayAwards && displayAwards?.length > 0 && (
        <div
          className={styles.awardsMarquee}
          aria-label="Nagrody produktu"
          data-use-marquee={shouldUseMarquee}
          style={
            shouldUseMarquee
              ? ({
                  '--animation-duration': `${animationDuration}s`,
                } as React.CSSProperties)
              : undefined
          }
        >
          <div className={styles.awardsTrack}>
            <div className={styles.awardsList}>
              {displayAwards.map((award, idx) => {
                const key = `${award._id}-${idx}`;
                const isDuplicate = shouldUseMarquee && idx >= awards!.length;

                return (
                  <Image
                    image={award.logo}
                    alt={award.name || 'Nagroda produktu'}
                    sizes="48px"
                    quality={90}
                    className={styles.awardLogo}
                    loading="lazy"
                    key={key}
                    aria-hidden={isDuplicate}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
