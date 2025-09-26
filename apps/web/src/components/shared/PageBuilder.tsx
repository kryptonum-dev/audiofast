import type { QueryHomePageResult } from '../../global/sanity/sanity.types';
import BrandsMarquee from '../pageBuilder/BrandsMarquee';
import FeaturedProducts from '../pageBuilder/FeaturedProducts';
import FeaturedPublications from '../pageBuilder/FeaturedPublications';
import Hero from '../pageBuilder/Hero';
import ImageTextColumns from '../pageBuilder/ImageTextColumns';
import LatestPublication from '../pageBuilder/LatestPublication';

// More specific and descriptive type aliases
// Shared block union derived from the shared pageBuilder fragment result
export type PageBuilderBlock = NonNullable<
  NonNullable<QueryHomePageResult>['pageBuilder']
>[number];

export interface PageBuilderProps {
  readonly pageBuilder?: PageBuilderBlock[];
}

type BlockType = PageBuilderBlock['_type'];
type BlockByType<T extends BlockType> = Extract<PageBuilderBlock, { _type: T }>;

/**
 * PageBuilder component for rendering dynamic content blocks from Sanity CMS
 */
export function PageBuilder({
  pageBuilder: initialBlocks = [],
}: PageBuilderProps) {
  const blocks = initialBlocks;

  if (!blocks.length) {
    return null;
  }

  return (
    <>
      {blocks.map((block) => {
        switch (block._type as BlockType) {
          case 'hero':
            return (
              <Hero key={block._key} {...(block as BlockByType<'hero'>)} />
            );
          case 'latestPublication':
            return (
              <LatestPublication
                key={block._key}
                {...(block as BlockByType<'latestPublication'>)}
              />
            );
          case 'imageTextColumns':
            return (
              <ImageTextColumns
                key={block._key}
                {...(block as BlockByType<'imageTextColumns'>)}
              />
            );
          case 'featuredPublications':
            return (
              <FeaturedPublications
                key={block._key}
                {...(block as BlockByType<'featuredPublications'>)}
              />
            );
          case 'featuredProducts':
            return (
              <FeaturedProducts
                key={block._key}
                {...(block as BlockByType<'featuredProducts'>)}
              />
            );
          case 'brandsMarquee':
            return (
              <BrandsMarquee
                key={block._key}
                {...(block as BlockByType<'brandsMarquee'>)}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
