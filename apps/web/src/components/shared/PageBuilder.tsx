import type { QueryHomePageResult } from '../../global/sanity/sanity.types';
import BlurLinesTextImage from '../pageBuilder/BlurLinesTextImage';
import BrandsMarquee from '../pageBuilder/BrandsMarquee';
import ContactForm from '../pageBuilder/ContactForm';
import ContactMap from '../pageBuilder/ContactMap';
import FaqSection from '../pageBuilder/FaqSection';
import FeaturedProducts from '../pageBuilder/FeaturedProducts';
import FeaturedPublications from '../pageBuilder/FeaturedPublications';
import GallerySection from '../pageBuilder/GallerySection';
import HeroCarousel from '../pageBuilder/HeroCarousel';
import HeroStatic from '../pageBuilder/HeroStatic';
import ImageTextColumns from '../pageBuilder/ImageTextColumns';
import ImageWithTextBoxes from '../pageBuilder/ImageWithTextBoxes';
import ImageWithVideo from '../pageBuilder/ImageWithVideo';
import LatestPublication from '../pageBuilder/LatestPublication';
import PhoneImageCta from '../pageBuilder/PhoneImageCta';
import TeamSection from '../pageBuilder/TeamSection';

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
      {blocks.map((block, index) => {
        switch (block._type as BlockType) {
          case 'heroCarousel':
            return (
              <HeroCarousel
                key={block._key}
                {...(block as BlockByType<'heroCarousel'>)}
                index={index}
              />
            );
          case 'heroStatic':
            return (
              <HeroStatic
                key={block._key}
                {...(block as BlockByType<'heroStatic'>)}
                index={index}
              />
            );
          case 'latestPublication':
            return (
              <LatestPublication
                key={block._key}
                {...(block as BlockByType<'latestPublication'>)}
                index={index}
              />
            );
          case 'imageTextColumns':
            return (
              <ImageTextColumns
                key={block._key}
                {...(block as BlockByType<'imageTextColumns'>)}
                index={index}
              />
            );
          case 'blurLinesTextImage':
            return (
              <BlurLinesTextImage
                key={block._key}
                {...(block as BlockByType<'blurLinesTextImage'>)}
                index={index}
              />
            );
          case 'imageWithVideo':
            return (
              <ImageWithVideo
                key={block._key}
                {...(block as BlockByType<'imageWithVideo'>)}
                index={index}
              />
            );
          case 'imageWithTextBoxes':
            return (
              <ImageWithTextBoxes
                key={block._key}
                {...(block as BlockByType<'imageWithTextBoxes'>)}
                index={index}
              />
            );
          case 'featuredPublications':
            return (
              <FeaturedPublications
                key={block._key}
                {...(block as BlockByType<'featuredPublications'>)}
                index={index}
              />
            );
          case 'featuredProducts':
            return (
              <FeaturedProducts
                key={block._key}
                {...(block as BlockByType<'featuredProducts'>)}
                index={index}
              />
            );
          case 'brandsMarquee':
            return (
              <BrandsMarquee
                key={block._key}
                {...(block as BlockByType<'brandsMarquee'>)}
                index={index}
              />
            );
          case 'faqSection':
            return (
              <FaqSection
                key={block._key}
                {...(block as BlockByType<'faqSection'>)}
                index={index}
              />
            );
          case 'contactForm':
            return (
              <ContactForm
                key={block._key}
                {...(block as BlockByType<'contactForm'>)}
                index={index}
              />
            );
          case 'contactMap':
            return (
              <ContactMap
                key={block._key}
                {...(block as BlockByType<'contactMap'>)}
                index={index}
              />
            );
          case 'teamSection':
            return (
              <TeamSection
                key={block._key}
                {...(block as BlockByType<'teamSection'>)}
                index={index}
              />
            );
          case 'gallerySection':
            return (
              <GallerySection
                key={block._key}
                {...(block as BlockByType<'gallerySection'>)}
                index={index}
              />
            );
          case 'phoneImageCta':
            return (
              <PhoneImageCta
                key={block._key}
                {...(block as BlockByType<'phoneImageCta'>)}
                index={index}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
