import type {
  SanityProjectedImage,
  SanityRawImage,
} from '@/components/shared/Image';
import type { QueryBrandBySlugResult } from '@/src/global/sanity/sanity.types';
import type { PortableTextProps } from '@/src/global/types';

import PortableText from '../../portableText';
import DistributionYearBadge from '../DistributionYearBadge';
import ProductGallery from '../ProductGallery';
import styles from './styles.module.scss';

type BrandProps = NonNullable<QueryBrandBySlugResult>;
export interface TwoColumnContentProps {
  content: BrandProps['brandDescription'];
  heading?: string;
  distributionYear?: number | null;
  distributionYearBackgroundImage?: BrandProps['bannerImage'];
  gallery?: BrandProps['imageGallery'];
}

export default function TwoColumnContent({
  content,
  heading,
  distributionYear,
  distributionYearBackgroundImage,
  gallery,
}: TwoColumnContentProps) {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return null;
  }

  // Split content into two columns at the midpoint
  const midpoint = Math.ceil(content.length / 2);
  const leftColumn = content.slice(0, midpoint);
  const rightColumn = content.slice(midpoint);

  const showGallery = gallery && gallery.length >= 4;

  return (
    <section className={styles.twoColumnContent}>
      <div className={styles.container}>
        {heading && <h2 className={styles.heading}>{heading}</h2>}
        <div className={styles.contentWrapper}>
          <div className={styles.column}>
            <PortableText
              value={leftColumn as PortableTextProps}
              enablePortableTextStyles
              className={styles.content}
            />
          </div>
          <div className={styles.divider} aria-hidden="true" />
          <div className={styles.column}>
            <PortableText
              value={rightColumn as PortableTextProps}
              enablePortableTextStyles
              className={styles.content}
            />
          </div>
        </div>

        {/* Distribution Year Badge */}
        {distributionYear && (
          <DistributionYearBadge
            year={distributionYear}
            backgroundImage={
              distributionYearBackgroundImage as SanityProjectedImage
            }
          />
        )}

        {/* Gallery Section */}
        {showGallery && (
          <div id="galeria" className={styles.galleryWrapper}>
            <ProductGallery images={gallery as SanityRawImage[]} />
          </div>
        )}
      </div>
    </section>
  );
}
