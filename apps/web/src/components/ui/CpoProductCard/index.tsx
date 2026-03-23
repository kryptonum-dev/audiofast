import Link from 'next/link';

import type { QueryCpoProductsListingNewestResult } from '@/src/global/sanity/sanity.types';
import type {
  PortableTextProps,
  PortableTextPropsBlock,
} from '@/src/global/types';

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

const SHORT_DESCRIPTION_PREVIEW_MAX_CHARS = 120;

const createPortableTextKey = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const shouldInsertInlineSeparator = (
  previousText: string,
  nextText: string,
): boolean => {
  if (!previousText || !nextText) return false;
  if (/\s$/.test(previousText) || /^\s/.test(nextText)) return false;
  if (/[([{]$/.test(previousText)) return false;
  if (/^[,.;:!?)]/.test(nextText)) return false;

  return true;
};

const truncatePortableText = (
  value: PortableTextProps | null | undefined,
  maxChars: number,
): NonNullable<PortableTextProps> => {
  if (!Array.isArray(value) || value.length === 0) return [];

  let remainingChars = maxChars;
  const inlineChildren: PortableTextPropsBlock['children'] = [];
  const inlineMarkDefs: NonNullable<PortableTextPropsBlock['markDefs']> = [];
  let lastAppendedText = '';

  for (const item of value) {
    if (remainingChars <= 0) break;
    if (!item || item._type !== 'block') continue;

    const block = item as PortableTextPropsBlock;
    const blockText = (block.children || [])
      .map((child) => child.text || '')
      .join('');

    if (
      inlineChildren.length > 0 &&
      remainingChars > 0 &&
      shouldInsertInlineSeparator(lastAppendedText, blockText)
    ) {
      inlineChildren.push({
        _key: createPortableTextKey('separator'),
        _type: 'span',
        marks: [],
        text: ' ',
      });
      lastAppendedText = ' ';
      remainingChars -= 1;
    }

    for (const child of block.children || []) {
      if (remainingChars <= 0) break;

      const text = child.text || '';

      if (text.length <= remainingChars) {
        inlineChildren.push(child);
        lastAppendedText = text;
        remainingChars -= text.length;
        continue;
      }

      const shortenedText = text.slice(0, remainingChars).trimEnd() || text;

      inlineChildren.push({
        ...child,
        text: `${shortenedText}...`,
      });
      lastAppendedText = `${shortenedText}...`;
      remainingChars = 0;
    }

    for (const markDef of block.markDefs ?? []) {
      if (
        !inlineMarkDefs.some(
          (existingMarkDef) => existingMarkDef._key === markDef._key,
        )
      ) {
        inlineMarkDefs.push(markDef);
      }
    }
  }

  if (inlineChildren.length === 0) return [];

  return [
    {
      _key: createPortableTextKey('block'),
      _type: 'block',
      children: inlineChildren,
      markDefs: inlineMarkDefs.filter((markDef) =>
        inlineChildren.some((child) => child.marks?.includes(markDef._key)),
      ),
      style: 'normal',
    },
  ];
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
    shortDescription,
    priceCents,
    brandName,
    mainImage,
    slug,
    productType,
    externalUrl,
    transparentBackground,
  } = product;

  const Heading = headingLevel;
  const isExternal = productType === 'external';
  const href = isExternal ? (externalUrl ?? '#') : (slug ?? '#');
  const brandLogo = null;
  const isTransparent = transparentBackground === true;
  const shortDescriptionPreview = truncatePortableText(
    shortDescription as PortableTextProps | null | undefined,
    SHORT_DESCRIPTION_PREVIEW_MAX_CHARS,
  );
  const hasShortDescriptionPreview = shortDescriptionPreview.length > 0;

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
      <div
        className={styles.container}
        data-has-description={hasShortDescriptionPreview}
      >
        <Heading className={styles.title}>
          {brandName ? `${brandName} ` : null}
          {name}
        </Heading>
        {hasShortDescriptionPreview && (
          <PortableTextRenderer
            value={shortDescriptionPreview}
            className={styles.shortDescription}
          />
        )}
        <div className={styles.priceContainer}>
          <span className={styles.price}>{formatPrice(priceCents)}</span>
          <Button tabIndex={-1} text="Dowiedz się więcej" variant="primary" />
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
