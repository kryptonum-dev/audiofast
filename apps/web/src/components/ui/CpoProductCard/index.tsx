import Link from 'next/link';

import type { QueryCpoProductsListingNewestResult } from '@/src/global/sanity/sanity.types';

import PortableTextRenderer from '../../portableText';
import Image from '../../shared/Image';
import Button from '../Button';
import styles from './styles.module.scss';

type CpoProductCardProps = {
  product: QueryCpoProductsListingNewestResult[number];
  headingLevel?: 'h2' | 'h3';
  imageSizes?: string;
  priority?: boolean;
  loading?: 'eager' | 'lazy';
};

const formatPrice = (priceCents: number | null | undefined): string => {
  if (!priceCents || priceCents === 0) return 'Cena do ustalenia';
  const priceInPLN = priceCents / 100;
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceInPLN);
};

export default function CpoProductCard({
  product,
  headingLevel = 'h3',
  imageSizes = '400px',
  priority = false,
  loading = 'lazy',
}: CpoProductCardProps) {
  const {
    name,
    subtitle,
    priceCents,
    brand,
    mainImage,
    slug,
    productType,
    externalUrl,
    transparentBackground,
  } = product;

  const Heading = headingLevel;
  const isExternal = productType === 'external';
  const href = isExternal ? (externalUrl ?? '#') : (slug ?? '#');
  const brandLogo = brand && 'logo' in brand && brand.logo ? brand.logo : null;
  const isTransparent = transparentBackground === true;

  const cardContent = (
    <>
      <div className={styles.imgBox} data-transparent={isTransparent}>
        <Image
          image={mainImage}
          sizes={imageSizes}
          fill
          priority={priority}
          loading={loading}
        />
        {isTransparent && brandLogo && (
          <>
            <span className={styles.logoBg} aria-hidden="true" />
            <Image image={brandLogo} sizes="90px" loading={loading} />
          </>
        )}
        {isTransparent && <span className={styles.badge}>Używany</span>}
      </div>
      <div className={styles.container}>
        <Heading className={styles.title}>
          {brand?.name && `${brand.name} `}
          {name}
        </Heading>
        {subtitle && subtitle.length > 0 && (
          <PortableTextRenderer value={subtitle} className={styles.subtitle} />
        )}
        <div className={styles.priceContainer}>
          <span className={styles.price}>{formatPrice(priceCents)}</span>
          <Button
            tabIndex={-1}
            text={isExternal ? 'Zobacz produkt' : 'Dowiedz się więcej'}
            variant="primary"
          />
        </div>
      </div>
    </>
  );

  return (
    <article className={styles.cpoProductCard}>
      {isExternal ? (
        <a
          href={href}
          className={styles.link}
          data-transparent={isTransparent}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cardContent}
        </a>
      ) : (
        <Link
          href={href}
          className={styles.link}
          data-transparent={isTransparent}
        >
          {cardContent}
        </Link>
      )}
    </article>
  );
}
