import type { Metadata } from 'next';
import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

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
import type { PortableTextProps } from '@/src/global/types';
import PillsStickyNav from '@/src/components/ui/PillsStickyNav';
import StoreLocations from '@/src/components/ui/StoreLocations';
import TwoColumnContent from '@/src/components/ui/TwoColumnContent';
import {
  PRODUCT_SORT_OPTIONS,
  RELEVANCE_SORT_OPTION,
} from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import {
  queryAllBrandSlugs,
  queryAllProductsFilterMetadata,
  queryBrandBySlug,
  queryBrandSeoBySlug,
} from '@/src/global/sanity/query';
import type {
  QueryAllBrandSlugsResult,
  QueryAllProductsFilterMetadataResult,
  QueryBrandBySlugResult,
  QueryBrandSeoBySlugResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
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
async function getBrandContent(slug: string) {
  'use cache';
  cacheLife('weeks');

  return sanityFetch<QueryBrandBySlugResult>({
    query: queryBrandBySlug,
    params: {
      slug: `/marki/${slug}/`,
      // Pass empty filters - we don't need filtered counts for PPR
      category: '',
      search: '',
      brands: [],
      minPrice: 0,
      maxPrice: 999999999,
      customFilters: [],
      embeddingResults: [],
    },
    tags: ['brand'],
  });
}

// Global filter metadata (shared across all pages, heavily cached)
async function getStaticFilterMetadata() {
  'use cache';
  cacheLife('weeks');

  return sanityFetch<QueryAllProductsFilterMetadataResult>({
    query: queryAllProductsFilterMetadata,
    tags: ['products'],
  });
}

// ----------------------------------------
// Static Params Generation
// ----------------------------------------
export async function generateStaticParams() {
  const brands = await sanityFetch<QueryAllBrandSlugsResult>({
    query: queryAllBrandSlugs,
    tags: ['brand'],
  });

  return brands
    .filter((brand) => brand.slug)
    .map((brand) => ({
      slug: brand.slug!.replace('/marki/', '').replace(/\/$/, ''),
    }));
}

// ----------------------------------------
// Metadata Generation
// ----------------------------------------
export async function generateMetadata({
  params,
}: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const seoData = await sanityFetch<QueryBrandSeoBySlugResult>({
    query: queryBrandSeoBySlug,
    params: { slug: `/marki/${slug}/` },
    tags: ['brand'],
  });

  if (!seoData) return getSEOMetadata();

  return getSEOMetadata({
    seo: seoData.seo,
    slug: seoData.slug,
    openGraph: seoData.openGraph,
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

  // Fetch all cached static data in parallel
  const [brand, filterMetadata] = await Promise.all([
    getBrandContent(slug),
    getStaticFilterMetadata(),
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
    brandPrices.length > 0 ? Math.max(...brandPrices) : 100000;

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
        image={brand.heroImage}
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
          <ProductsListingContainer>
            <Suspense fallback={<ProductsListingSkeleton />}>
              <ProductsListing
                searchParams={searchParams}
                basePath={`/marki/${slug}/`}
                brandSlug={slug}
                defaultSortBy="newest"
              />
            </Suspense>
          </ProductsListingContainer>
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

      {brand.stores &&
        Array.isArray(brand.stores) &&
        brand.stores.length > 0 && (
          <StoreLocations
            customId="gdzie-kupic"
            stores={brand.stores.filter((s) => s !== null)}
          />
        )}
    </main>
  );
}
