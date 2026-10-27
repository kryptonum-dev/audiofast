import { Fragment, type ReactNode } from 'react';

import { getDataAttribute } from '../../global/sanity/data-attribute';
import type { DynamicFetchOptions } from '../../global/sanity/live';
import type {
  QueryCpoPageResult,
  QueryHomePageResult,
} from '../../global/sanity/sanity.types';
import BlurLinesTextImage from '../pageBuilder/BlurLinesTextImage';
import BrandsByCategoriesSection from '../pageBuilder/BrandsByCategoriesSection';
import BrandsList from '../pageBuilder/BrandsList';
import BrandsMarquee from '../pageBuilder/BrandsMarquee';
import ContactForm from '../pageBuilder/ContactForm';
import ContactMap from '../pageBuilder/ContactMap';
import CpoProductsListing from '../pageBuilder/CpoProductsListing';
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
import ProductsCarousel from '../pageBuilder/ProductsCarousel';
import StepList from '../pageBuilder/StepList';
import TeamSection from '../pageBuilder/TeamSection';

// Standard pageBuilder blocks
type StandardPageBuilderBlock = NonNullable<
  NonNullable<QueryHomePageResult>['pageBuilder']
>[number];

// CPO pageBuilder blocks (includes cpoProductsListing)
type CpoPageBuilderBlock = NonNullable<
  NonNullable<QueryCpoPageResult>['pageBuilder']
>[number];

// Union of both types to support all blocks
export type PageBuilderBlock = StandardPageBuilderBlock | CpoPageBuilderBlock;

/**
 * Request-time content built by the page OUTSIDE every cache scope and passed
 * through the cached page untouched (shape B, research/08 §1). PageBuilder
 * renders a slot where its block sits.
 */
export interface PageBuilderSlots {
  /** `cpoProductsListing`: the searchParams-driven listing in Suspense. */
  readonly cpoListing?: ReactNode;
}

export interface PageBuilderProps {
  readonly pageBuilder?: PageBuilderBlock[];
  /** The page's perspective/stega, for blocks that read Sanity on their own. */
  readonly fetchOptions?: DynamicFetchOptions;
  readonly slots?: PageBuilderSlots;
  readonly basePath?: string; // Current page path for listing blocks
  readonly indexOffset?: number; // Offset for block index to prevent multiple H1s
  /**
   * The document that owns the `pageBuilder` array. With `isDraft`, every block
   * is wrapped in a `data-sanity` element addressing
   * `pageBuilder[_key=="…"]`, so the whole block is click-to-edit in
   * Presentation. Published renders get a keyed Fragment instead, so the
   * markup is identical to the pre-visual-editing render.
   */
  readonly documentId?: string | null;
  readonly documentType?: string | null;
  readonly isDraft?: boolean;
}

type BlockType = PageBuilderBlock['_type'];
type BlockByType<T extends BlockType> = Extract<PageBuilderBlock, { _type: T }>;

/**
 * PageBuilder component for rendering dynamic content blocks from Sanity CMS
 */
export function PageBuilder({
  pageBuilder: initialBlocks = [],
  fetchOptions,
  slots,
  basePath,
  indexOffset = 0,
  documentId,
  documentType,
  isDraft,
}: PageBuilderProps) {
  const blocks = initialBlocks;

  if (!blocks.length) {
    return null;
  }

  // `null` outside draft mode: no wrapper element and no attribute.
  const dataAttribute = getDataAttribute({
    id: documentId,
    type: documentType,
    isDraft,
  });

  return (
    <>
      {blocks.map((block, index) => {
        const element = renderBlock(block, index + indexOffset);
        if (!element) return null;
        // Bare `_key` as the React key in both branches: Phase 9's optimistic
        // reorder matches children on the raw key.
        if (!dataAttribute) {
          return <Fragment key={block._key}>{element}</Fragment>;
        }
        return (
          <div
            key={block._key}
            data-sanity={dataAttribute(['pageBuilder', { _key: block._key }])}
          >
            {element}
          </div>
        );
      })}
    </>
  );

  function renderBlock(block: PageBuilderBlock, effectiveIndex: number) {
    switch (block._type as BlockType) {
      case 'heroCarousel':
        return (
          <HeroCarousel
            key={block._key}
            {...(block as BlockByType<'heroCarousel'>)}
            index={effectiveIndex}
          />
        );
      case 'heroStatic':
        return (
          <HeroStatic
            key={block._key}
            {...(block as BlockByType<'heroStatic'>)}
            index={effectiveIndex}
          />
        );
      case 'latestPublication':
        return (
          <LatestPublication
            key={block._key}
            {...(block as BlockByType<'latestPublication'>)}
            index={effectiveIndex}
          />
        );
      case 'imageTextColumns':
        return (
          <ImageTextColumns
            key={block._key}
            {...(block as BlockByType<'imageTextColumns'>)}
            index={effectiveIndex}
          />
        );
      case 'blurLinesTextImage':
        return (
          <BlurLinesTextImage
            key={block._key}
            {...(block as BlockByType<'blurLinesTextImage'>)}
            index={effectiveIndex}
          />
        );
      case 'imageWithVideo':
        return (
          <ImageWithVideo
            key={block._key}
            {...(block as BlockByType<'imageWithVideo'>)}
            index={effectiveIndex}
          />
        );
      case 'imageWithTextBoxes':
        return (
          <ImageWithTextBoxes
            key={block._key}
            {...(block as BlockByType<'imageWithTextBoxes'>)}
            index={effectiveIndex}
          />
        );
      case 'featuredPublications':
        return (
          <FeaturedPublications
            key={block._key}
            {...(block as BlockByType<'featuredPublications'>)}
            index={effectiveIndex}
          />
        );
      case 'featuredProducts':
        return (
          <FeaturedProducts
            key={block._key}
            {...(block as BlockByType<'featuredProducts'>)}
            index={effectiveIndex}
          />
        );
      case 'productsCarousel':
        return (
          <ProductsCarousel
            key={block._key}
            {...(block as BlockByType<'productsCarousel'>)}
            index={effectiveIndex}
          />
        );
      case 'cpoProductsListing':
        return (
          <CpoProductsListing
            key={block._key}
            {...(block as BlockByType<'cpoProductsListing'>)}
            index={effectiveIndex}
            basePath={basePath}
            fetchOptions={fetchOptions}
            listing={slots?.cpoListing}
          />
        );
      case 'brandsMarquee':
        return (
          <BrandsMarquee
            key={block._key}
            {...(block as BlockByType<'brandsMarquee'>)}
            index={effectiveIndex}
          />
        );
      case 'brandsList':
        return (
          <BrandsList
            key={block._key}
            {...(block as BlockByType<'brandsList'>)}
            index={effectiveIndex}
          />
        );
      case 'brandsByCategoriesSection':
        return (
          <BrandsByCategoriesSection
            key={block._key}
            {...(block as BlockByType<'brandsByCategoriesSection'>)}
            index={effectiveIndex}
          />
        );
      case 'faqSection':
        return (
          <FaqSection
            key={block._key}
            {...(block as BlockByType<'faqSection'>)}
            index={effectiveIndex}
            isDraft={isDraft}
          />
        );
      case 'contactForm':
        return (
          <ContactForm
            key={block._key}
            {...(block as BlockByType<'contactForm'>)}
            index={effectiveIndex}
            isDraft={isDraft}
          />
        );
      case 'contactMap':
        return (
          <ContactMap
            key={block._key}
            {...(block as BlockByType<'contactMap'>)}
            index={effectiveIndex}
          />
        );
      case 'teamSection':
        return (
          <TeamSection
            key={block._key}
            {...(block as BlockByType<'teamSection'>)}
            index={effectiveIndex}
            isDraft={isDraft}
          />
        );
      case 'gallerySection':
        return (
          <GallerySection
            key={block._key}
            {...(block as BlockByType<'gallerySection'>)}
            index={effectiveIndex}
          />
        );
      case 'phoneImageCta':
        return (
          <PhoneImageCta
            key={block._key}
            {...(block as BlockByType<'phoneImageCta'>)}
            index={effectiveIndex}
          />
        );
      case 'stepList':
        return (
          <StepList
            key={block._key}
            {...(block as BlockByType<'stepList'>)}
            index={effectiveIndex}
          />
        );
      default:
        return null;
    }
  }
}
