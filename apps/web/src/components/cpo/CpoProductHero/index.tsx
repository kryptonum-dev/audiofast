import ProductDescription from '@/src/components/products/ProductHero/ProductDescription';
import productHeroStyles from '@/src/components/products/ProductHero/styles.module.scss';
import type { SanityRawImage } from '@/src/components/shared/Image';
import type { FormStateData } from '@/src/components/ui/FormStates';
import type { PortableTextProps } from '@/src/global/types';

import Image from '../../shared/Image';
import CpoProductInquirySection from './CpoProductInquirySection';
import styles from './styles.module.scss';

type CpoProductHeroProps = {
  productId: string;
  name?: string | null;
  brand?: {
    name?: string | null;
    logo?: SanityRawImage | null;
  } | null;
  previewImage?: SanityRawImage | null;
  shortDescription?: PortableTextProps | null;
  priceCents?: number | null;
  transparentBackground?: boolean | null;
  formStateData?: FormStateData | null;
  customId?: string;
};

export default function CpoProductHero({
  productId,
  name,
  brand,
  previewImage,
  shortDescription,
  priceCents,
  transparentBackground,
  formStateData,
  customId,
}: CpoProductHeroProps) {
  const productName = name?.trim() || '';
  const hasBrandLogo = !!brand?.logo;
  const hasShortDescription =
    Array.isArray(shortDescription) && shortDescription.length > 0;

  return (
    <section
      className={`${productHeroStyles.productHero} ${styles.cpoProductHero} max-width`}
      id={customId}
      data-has-description={hasShortDescription}
      data-has-awards={false}
    >
      {transparentBackground ? (
        <Image
          image={previewImage}
          sizes="(max-width: 56.1875rem) 96vw, (max-width: 85.375rem) 48vw, 951px"
          priority
          className={productHeroStyles.previewImage}
        />
      ) : (
        <div className={`${styles.mediaArea} ${styles.singleGallerySurface}`}>
          <div className={styles.blurredBackground}>
            <Image
              image={previewImage}
              sizes="(max-width: 56.1875rem) 96vw, (max-width: 85.375rem) 48vw, 951px"
              loading="lazy"
              aria-hidden="true"
            />
          </div>
          <Image
            image={previewImage}
            sizes="(max-width: 56.1875rem) 96vw, (max-width: 85.375rem) 48vw, 951px"
            priority
            className={styles.singleGalleryImage}
          />
        </div>
      )}

      <header
        className={`${productHeroStyles.header} ${styles.header}`}
        data-has-logo={hasBrandLogo}
      >
        {hasBrandLogo && (
          <div className={`${productHeroStyles.brandLogo} ${styles.brandLogo}`}>
            <Image
              image={brand.logo}
              sizes="(max-width: 56.1875rem) 96px, 128px"
              loading="lazy"
            />
          </div>
        )}

        <h1 className={productHeroStyles.heading}>
          {brand?.name ? (
            <>
              {brand.name}
              <br />
              {productName}
            </>
          ) : (
            productName
          )}
        </h1>
      </header>

      {hasShortDescription && (
        <ProductDescription shortDescription={shortDescription} />
      )}

      <CpoProductInquirySection
        productId={productId}
        productName={productName}
        brandName={brand?.name}
        brandLogo={brand?.logo || undefined}
        previewImage={previewImage}
        priceCents={priceCents}
        formStateData={formStateData}
      />
    </section>
  );
}
