import type { SanityRawImage } from '@/components/shared/Image';
import Image from '@/components/shared/Image';
import type { QueryBrandBySlugResult } from '@/src/global/sanity/sanity.types';
import type { PortableTextProps } from '@/src/global/types';

import PortableText from '../../portableText';
import ProductGallery from '../ProductGallery';
// import ProductGallery from '../ProductGallery';
import styles from './styles.module.scss';

export interface TwoColumnContentProps {
  content: PortableTextProps;
  customId?: string;
  headingContent?: PortableTextProps;
  distributionYear?: NonNullable<QueryBrandBySlugResult>['distributionYear'];
  gallery?: SanityRawImage[];
}

export default function TwoColumnContent({
  content,
  customId,
  headingContent,
  distributionYear,
  gallery,
}: TwoColumnContentProps) {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return null;
  }

  console.log(gallery);

  return (
    <section
      className={` max-width-block ${styles.twoColumnContent}`}
      id={customId || undefined}
    >
      <PortableText
        value={headingContent as PortableTextProps}
        headingLevel="h2"
        className={styles.heading}
      />
      <div className={styles.contentWrapper}>
        <PortableText
          value={content}
          enablePortableTextStyles
          className={styles.content}
        />
      </div>
      {distributionYear && (
        <div className={styles.distributionYearBadge}>
          <Image
            image={distributionYear.backgroundImage}
            sizes="(max-width: 37.4375rem) 96vw, (max-width: 85.375rem) 90vw, 1238px"
            loading="lazy"
            fill
          />
          <h3>
            Jesteśmy oficjalnym dystrybutorem tej marki od{' '}
            {distributionYear.year} roku.
          </h3>
        </div>
      )}
      {gallery && (
        <ProductGallery images={gallery} customId="galeria" isSection={false} />
      )}
    </section>
  );
}
