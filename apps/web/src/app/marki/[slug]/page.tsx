import type { Metadata } from 'next';
import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

import FeaturedPublications from '@/src/components/pageBuilder/FeaturedPublications';
import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import ProductsAside from '@/src/components/products/ProductsAside';
import ProductsListing from '@/src/components/products/ProductsListing';
import ProductsListingSkeleton from '@/src/components/products/ProductsListing/ProductsListingSkeleton';
import styles from '@/src/components/products/ProductsListing/styles.module.scss';
import ProductsListingContainer from '@/src/components/products/ProductsListingContainer';
import { ProductsLoadingProvider } from '@/src/components/products/ProductsLoadingContext';
import SortDropdown from '@/src/components/products/SortDropdown';
import BrandSchema from '@/src/components/schema/BrandSchema';
import type { SanityRawImage } from '@/src/components/shared/Image';
import Image from '@/src/components/shared/Image';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import type { ContentBlock } from '@/src/components/ui/ContentBlocks';
import PillsStickyNav from '@/src/components/ui/PillsStickyNav';
import StoreLocations from '@/src/components/ui/StoreLocations';
import StoreLocationsSkeleton from '@/src/components/ui/StoreLocations/StoreLocationsSkeleton';
import TwoColumnContent from '@/src/components/ui/TwoColumnContent';
import { allBuildTimeStaticParams } from '@/src/global/build';
import {
  PRODUCT_SORT_OPTIONS,
  RELEVANCE_SORT_OPTION,
} from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { getProductsFilterMetadata } from '@/src/global/products/filter-metadata';
import { getDataAttribute } from '@/src/global/sanity/data-attribute';
import {
  type CachedProps,
  renderDraftAware,
} from '@/src/global/sanity/draft-aware';
import {
  type DynamicFetchOptions,
  PUBLISHED,
  sanityFetchCached,
  sanityFetchStaticParams,
} from '@/src/global/sanity/live';
import {
  queryAllBrandSlugs,
  queryBrandBySlug,
} from '@/src/global/sanity/query';
import type {
  QueryAllBrandSlugsResult,
  QueryBrandBySlugResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import type { PortableTextProps } from '@/src/global/types';
import type { PublicationType } from '@/src/global/types';

type BrandPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    category?: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
};

// ----------------------------------------
// Cached Static Data Fetchers
// ----------------------------------------

// Brand content (specific to each brand, but cacheable)
function getBrandContent(slug: string, options: DynamicFetchOptions) {
  return sanityFetchCached<QueryBrandBySlugResult>({
    requestTag: 'brand.page',
    query: queryBrandBySlug,
    params: {
      slug: `/marki/${slug}/`,
    },
    ...options,
    tags: ['brand', `brand:${slug}`],
  });
}

// Global filter metadata (shared across all pages, heavily cached)
// Tagged with its own `filter-metadata` tag rather than the broad `products` /
// `brands` tags. This data really does derive from every product, brand and
// category, so it still has to be invalidated when any of them is published —
// but it is now an explicit, single-purpose dependency instead of riding tags
// that also carry page content. Because this fetch is awaited alongside the
// brand document, whatever tags it carries end up on the brand page's static
// shell (tags propagate from nested `use cache` entries to the outer one), so
// keeping it off `products` is what stops every product publish from cooling
// all ~41 brand shells.
// (`getProductsFilterMetadata`, shared with the other listing routes.)

// ----------------------------------------
// Static Params Generation
// ----------------------------------------
export async function generateStaticParams() {
  const brands = await sanityFetchStaticParams<QueryAllBrandSlugsResult>({
    requestTag: 'brand.static-params',
    query: queryAllBrandSlugs,
    // `brands` is what a brand publish invalidates now that the broad `brand`
    // tag is reserved for fallbacks — keep both so the slug list stays current.
    tags: ['brand', 'brands'],
  });

  // Brands always prerender their full set (`allBuildTimeStaticParams`), even
  // in local builds that limit the other routes: there are only ~41, linked
  // from the main navigation and the homepage.
  return allBuildTimeStaticParams(
    brands
      .filter((brand) => brand.slug)
      .map((brand) => ({
        slug: brand.slug!.replace('/marki/', '').replace(/\/$/, ''),
      })),
    // cacheComponents treats an empty `generateStaticParams` as a build error
    // (`empty-generate-static-params`), and this route now emits the whole list
    // rather than a guaranteed-non-empty slice — so guard the empty/unreachable
    // dataset case with a placeholder. The page `notFound()`s for it.
    { slug: '__placeholder__' },
  );
}

// ----------------------------------------
// Metadata Generation
// ----------------------------------------
export async function generateMetadata({
  params,
}: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;

  // Deliberately the *same* cached fetcher the page body calls. `getBrandContent`
  // is a `use cache` scope keyed on `slug`, and `sanityFetch` underneath it is
  // keyed on (query, params, tags) — so `generateMetadata` and `BrandPage` hit one
  // cache entry and therefore one Sanity round trip. Previously this issued a
  // second, uncached `queryBrandSeoBySlug` fetch for the same document.
  const brand = await getBrandContent(slug, PUBLISHED);

  if (!brand) return getSEOMetadata();

  return getSEOMetadata({
    seo: brand.seo,
    slug: brand.slug,
    openGraph: brand.openGraph,
    noNotIndex: brand.doNotIndex,
  });
}

// ----------------------------------------
// Page Component
// ----------------------------------------
export default async function BrandPage({
  params,
  searchParams,
}: BrandPageProps) {
  const { slug } = await params;

  // Pass-through slot (shape B): built here, outside every cache scope, and
  // handed to the cached shell untouched.
  const listing = (
    <Suspense fallback={<ProductsListingSkeleton />}>
      <ProductsListing
        searchParams={searchParams}
        basePath={`/marki/${slug}/`}
        brandSlug={slug}
        defaultSortBy="newest"
        scrollTargetId="produkty"
      />
    </Suspense>
  );

  return renderDraftAware(CachedBrandShell, { slug, listing });
}

async function CachedBrandShell({
  slug,
  listing,
  perspective,
  stega,
  isDraft,
}: CachedProps & { slug: string; listing: ReactNode }) {
  'use cache';
  cacheLife('sanity');
  const [brand, filterMetadata] = await Promise.all([
    getBrandContent(slug, { perspective, stega }),
    getProductsFilterMetadata(perspective),
  ]);

  if (!brand) {
    logWarn(`Brand not found for slug: ${slug}, returning 404`);
    notFound();
  }

  if (!filterMetadata) {
    logWarn(`Filter metadata not found for brand page: ${slug}`);
    notFound();
  }

  // Pre-filter products metadata to only this brand's products
  // This ensures the sidebar shows categories/prices only for this brand
  const brandProductsMetadata =
    filterMetadata.products?.filter((p) => p.brandSlug === slug) || [];

  // Calculate max price for this brand's products
  const brandPrices = brandProductsMetadata
    .map((p) => p.basePriceCents)
    .filter((p): p is number => p !== null && p !== undefined);
  const brandMaxPrice =
    brandPrices.length > 0
      ? Math.max(...brandPrices)
      : filterMetadata.globalMaxPrice || 100000;

  const breadcrumbsData = [
    {
      name: 'Marki',
      path: '/marki',
    },
    {
      name: brand.name || '',
      path: brand.slug || '',
    },
  ];

  // Determine which sections are visible for sticky navigation
  const sections = [
    { id: 'produkty', label: 'Produkty', visible: true },
    {
      id: 'o-marce',
      label: 'O marce',
      visible:
        (!!brand.brandDetailContent && brand.brandDetailContent.length > 0) ||
        (!!brand.brandContentBlocks && brand.brandContentBlocks.length > 0),
    },
    {
      id: 'recenzje',
      label: 'Recenzje',
      visible: !!brand.featuredReviews,
    },
    {
      id: 'gdzie-kupic',
      label: 'Gdzie kupić',
      visible: !!brand.stores,
    },
  ].filter((section) => section.visible);

  return (
    <main id="main" className="page-transition">
      <BrandSchema brand={brand} />
      <Breadcrumbs data={breadcrumbsData} firstItemType="heroStatic" />
      <HeroStatic
        heading={[
          {
            _type: 'block',
            children: [{ _type: 'span', text: brand.name || '', _key: '' }],
            style: 'normal',
            _key: '',
            markDefs: null,
            listItem: undefined,
            level: undefined,
          },
        ]}
        description={brand.description}
        image={brand.heroImage!}
        showBlocks={false}
        blocksHeading={null}
        blocks={[]}
        index={0}
        _key=""
        _type="heroStatic"
        button={null}
      />
      {sections.length > 1 && <PillsStickyNav sections={sections} />}

      <ProductsLoadingProvider>
        <section
          id="produkty"
          className={`${styles.productsListing} max-width`}
        >
          {/* Client-side computed sidebar - filtered to this brand's products */}
          <ProductsAside
            allProductsMetadata={brandProductsMetadata}
            allCategories={filterMetadata.categories || []}
            allBrands={filterMetadata.brands || []}
            globalMaxPrice={brandMaxPrice}
            basePath={`/marki/${slug}/`}
            visibleFilters={{
              search: true,
              categories: true,
              brands: false,
              priceRange: true,
            }}
            headingLevel="h2"
          />

          <SortDropdown
            options={[RELEVANCE_SORT_OPTION, ...PRODUCT_SORT_OPTIONS]}
            basePath={`/marki/${slug}/`}
            defaultValue="newest"
          />

          {/* Products listing - container shows overlay skeleton on filter changes */}
          <ProductsListingContainer>{listing}</ProductsListingContainer>
        </section>
      </ProductsLoadingProvider>

      {brand.bannerImage && (
        <section className="max-width-block br-md margin-bottom-lg">
          <Image
            image={brand.bannerImage}
            alt={brand.name || ''}
            className="br-md full-width"
            sizes="(max-width: 37.4375rem) 98vw, (max-width: 85.375rem) 96vw, 1302px"
            loading="lazy"
          />
        </section>
      )}

      <TwoColumnContent
        unifiedContent={brand.brandDetailContent as PortableTextProps}
        contentBlocks={brand.brandContentBlocks as ContentBlock[]}
        customId="o-marce"
        distributionYear={brand.distributionYear}
        unifiedContentDataAttribute={getDataAttribute({
          id: brand._id,
          type: 'brand',
          isDraft,
        })?.scope('brandDetailContent')}
        gallery={brand.imageGallery as SanityRawImage[]}
      />

      {brand.featuredReviews && (
        <FeaturedPublications
          heading={[
            {
              _type: 'block',
              children: [
                {
                  _type: 'span',
                  text: 'Recenzje Marki',
                  _key: 'recenzje-marki',
                },
              ],
              style: 'normal',
              _key: '',
              markDefs: null,
              listItem: undefined,
              level: undefined,
            },
          ]}
          selectionMode="latest"
          publications={brand.featuredReviews as unknown as PublicationType[]}
          index={1}
          _key=""
          _type="featuredPublications"
          customId="recenzje"
        />
      )}

      {/*
        Geocoding the dealer list against OpenStreetMap Nominatim used to sit in
        the static shell, so every one of the ~41 prerendered brand pages waited
        on a third-party service before it could ship any HTML. Behind this
        boundary the shell is emitted immediately and the section streams in —
        normally straight out of the per-address `use cache` entry inside
        `StoreLocations`, and only occasionally from a live Nominatim round trip.
      */}
      {brand.stores &&
        Array.isArray(brand.stores) &&
        brand.stores.length > 0 && (
          <Suspense
            fallback={
              <StoreLocationsSkeleton
                customId="gdzie-kupic"
                storeCount={brand.stores.length}
              />
            }
          >
            <StoreLocations
              customId="gdzie-kupic"
              stores={brand.stores.filter((s) => s !== null)}
              isDraft={isDraft}
              storesAttribute={getDataAttribute({
                id: brand._id,
                type: 'brand',
                isDraft,
              })?.scope('stores')}
            />
          </Suspense>
        )}
    </main>
  );
}
