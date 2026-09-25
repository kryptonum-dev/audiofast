import Link from 'next/link';

import type { SanityRawImage } from '@/components/shared/Image';
import Image from '@/components/shared/Image';
import Button from '@/src/components/ui/Button';
import type { FormStateData } from '@/src/components/ui/FormStates';
import type { CompletePricingData } from '@/src/global/supabase/types';
import type { BrandType, PortableTextProps } from '@/src/global/types';

import AddToComparison from './AddToComparison';
import AwardItem from './AwardItem';
import PricingSection from './PricingSection';
import ProductDescription from './ProductDescription';
import styles from './styles.module.scss';

export type AwardType = {
  _id: string;
  name: string;
  logo?: SanityRawImage | null;
};

export type ArchivedCta = {
  text?: string | null;
  href?: string | null;
  openInNewTab?: boolean | null;
};

const DEFAULT_ARCHIVED_CTA = {
  text: 'Skontaktuj się z nami',
  href: '/kontakt',
} as const;

interface ProductHeroProps {
  name: string;
  subtitle?: string;
  headingOverride?: {
    upper?: string | null;
    lower?: string | null;
  } | null;
  brand?: BrandType;
  pricingData?: CompletePricingData | null;
  isBuyable: boolean;
  /** Archived product without a price — renders the "unavailable" notice */
  isUnavailable?: boolean;
  /** Contact CTA from Sanity settings, shown instead of "Zapytaj o produkt" when unavailable */
  archivedCta?: ArchivedCta | null;
  isReturnable: boolean;
  previewImage: SanityRawImage;
  shortDescription?: PortableTextProps;
  awards?: AwardType[];
  customId?: string;
  productId?: string;
  categories?: Array<{ slug?: string | null; name?: string | null }> | null;
  formStateData?: FormStateData | null;
}

export default function ProductHero({
  name,
  subtitle,
  headingOverride,
  brand,
  pricingData,
  isBuyable,
  isUnavailable = false,
  archivedCta,
  isReturnable,
  previewImage,
  shortDescription,
  awards,
  customId,
  productId,
  categories,
  formStateData,
}: ProductHeroProps) {
  const headingUpper = headingOverride?.upper?.trim() || brand?.name?.trim();
  const headingLower = headingOverride?.lower?.trim() || name.trim();

  // Prepare awards for display
  const shouldUseMarquee = awards && awards.length >= 8;
  const displayAwards = shouldUseMarquee ? [...awards, ...awards] : awards;

  // Calculate animation duration based on number of items
  // Base: 2s per item, min 15s, max 45s
  const getAnimationDuration = () => {
    if (!shouldUseMarquee || !awards) return 30;
    const duration = awards.length * 3;
    return Math.max(20, Math.min(60, duration));
  };

  const animationDuration = getAnimationDuration();

  return (
    <section
      className={`${styles.productHero} max-width`}
      id={customId}
      data-has-description={!!shortDescription}
      data-has-awards={!!awards && awards.length > 0}
    >
      <Image
        image={previewImage}
        sizes="(max-width: 56.1875rem) 96vw, (max-width: 85.375rem) 48vw, 951px"
        priority
        className={styles.previewImage}
      />
      <header className={styles.header}>
        <div className={styles.brandLogo}>
          <Image
            image={brand!.logo}
            sizes="(max-width: 56.1875rem) 96px, 128px"
            loading="lazy"
          />
        </div>
        {subtitle && <span className={styles.prefix}>{subtitle}</span>}
        <h1 className={styles.heading}>
          {headingUpper && `${headingUpper} `}
          <span>{headingLower}</span>
        </h1>
      </header>
      {shortDescription && shortDescription.length > 0 && (
        <ProductDescription shortDescription={shortDescription} />
      )}
      <div className={styles.priceWrapper} data-unavailable={isUnavailable}>
        {isUnavailable ? (
          <div className={styles.archived} role="status" aria-live="polite">
            <span className={styles.archivedEyebrow}>Produkt archiwalny</span>
            <span className={styles.archivedStatus}>Niedostępny</span>
            <p className={styles.archivedText}>
              Ten model nie jest już dostępny w naszej ofercie. Chętnie
              doradzimy jego następcę lub podobny sprzęt z aktualnej oferty.
            </p>
          </div>
        ) : !pricingData ? (
          <span className={styles.price}>Brak ceny</span>
        ) : null}

        {isUnavailable ? (
          <div className={styles.buttonsWrapper}>
            <Button
              href={archivedCta?.href || DEFAULT_ARCHIVED_CTA.href}
              text={archivedCta?.text || DEFAULT_ARCHIVED_CTA.text}
              openInNewTab={archivedCta?.openInNewTab ?? false}
              className={styles.inquiryButton}
            />
          </div>
        ) : (
          <PricingSection
            pricingData={pricingData}
            isBuyable={isBuyable}
            product={{
              id: productId || '',
              name,
              brandName: brand?.name || '',
              isReturnable,
              brandLogo: brand?.logo || undefined,
              image: previewImage,
            }}
            formStateData={formStateData}
          />
        )}

        {isUnavailable && brand?.slug ? (
          <Link
            href={brand.slug}
            className={`link ${styles.archivedBrandLink}`}
          >
            Zobacz aktualną ofertę {brand.name}
          </Link>
        ) : null}

        {!isUnavailable && (
          <AddToComparison
            productId={productId}
            categories={categories}
            productName={name}
            productData={{
              _id: productId,
              name,
              brand,
              mainImage: previewImage,
            }}
          />
        )}
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
                  <AwardItem
                    key={key}
                    award={award}
                    isDuplicate={isDuplicate}
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
