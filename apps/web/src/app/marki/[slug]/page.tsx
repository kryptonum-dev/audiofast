import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import ProductsAside from '@/src/components/products/ProductsAside';
import ProductsListing from '@/src/components/products/ProductsListing';
import ProductsListingSkeleton from '@/src/components/products/ProductsListing/ProductsListingSkeleton';
import styles from '@/src/components/products/ProductsListing/styles.module.scss';
import SortDropdown from '@/src/components/products/SortDropdown';
import Image from '@/src/components/shared/Image';
import BrandStickyNav from '@/src/components/ui/BrandStickyNav';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import TwoColumnContent from '@/src/components/ui/TwoColumnContent';
import {
  PRODUCT_SORT_OPTIONS,
  PRODUCTS_ITEMS_PER_PAGE,
} from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/client';
import {
  queryAllBrandSlugs,
  queryBrandBySlug,
} from '@/src/global/sanity/query';
import type {
  QueryAllBrandSlugsResult,
  QueryBrandBySlugResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import { parsePrice } from '@/src/global/utils';

type BrandPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    category?: string; // Category filter via search param (e.g., ?category=glosniki-podlogowe)
    minPrice?: string;
    maxPrice?: string;
  }>;
};

// Fetch brand data with filter metadata
// The query now includes products filter metadata (categories, brands, price ranges)
// Pass filter params to get filtered counts
function fetchBrandData(
  slug: string,
  filters?: {
    category?: string;
    search?: string;
    brands?: string[];
    minPrice?: number;
    maxPrice?: number;
  }
) {
  return sanityFetch<QueryBrandBySlugResult>({
    query: queryBrandBySlug,
    params: {
      slug: `/marki/${slug}/`,
      category: filters?.category || '', // Category filter via search param
      search: filters?.search || '',
      brands: filters?.brands || [],
      minPrice: filters?.minPrice || 0,
      maxPrice: filters?.maxPrice || 999999999,
      customFilters: [], // Brand pages don't have custom filters
    },
    tags: ['brand', slug, 'products', 'product'],
  });
}

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

export async function generateMetadata({
  params,
}: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await fetchBrandData(slug);

  if (!brand) return getSEOMetadata();

  return getSEOMetadata({
    seo: brand.seo,
    slug: brand.slug,
    openGraph: brand.openGraph,
  });
}

export default async function BrandPage(props: BrandPageProps) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;

  // Parse search params
  const currentPage = Number(searchParams.page) || 1;
  const searchTerm = searchParams.search || '';
  const categorySlug = searchParams.category || ''; // Category filter via search param (e.g., "glosniki-podstawkowe")

  // Normalize category slug to match Sanity format: /kategoria/slug/
  // Query expects: /kategoria/glosniki-podstawkowe/
  // URL has: glosniki-podstawkowe
  const normalizedCategory = categorySlug ? `/kategoria/${categorySlug}/` : '';

  const hasSearchQuery = Boolean(searchTerm);
  const sortBy = hasSearchQuery ? 'orderRank' : searchParams.sortBy || 'newest';
  let minPrice = parsePrice(searchParams.minPrice, 0);
  let maxPrice = parsePrice(searchParams.maxPrice, 999999999, 999999999);

  // Fetch brand data with filter metadata in a single API call
  // NOTE: We don't pass category filter here to get ALL categories in sidebar
  // The category filter is applied only in ProductsListing component
  const brand = await fetchBrandData(slug, {
    category: '', // Don't filter categories in sidebar - show all categories
    search: searchTerm,
    brands: [slug], // Filter products by current brand
    minPrice,
    maxPrice,
  });

  if (!brand) {
    logWarn(`Brand not found for slug: ${slug}, returning 404`);
    notFound();
  }

  // Get the actual maximum price from filtered products
  const actualMaxPrice = brand.maxPrice ?? 100000;
  const actualMinPrice = brand.minPrice ?? 0;

  // Validate and adjust price range
  if (minPrice > actualMaxPrice) {
    minPrice = actualMinPrice;
  }
  if (maxPrice > actualMaxPrice) {
    maxPrice = actualMaxPrice;
  }
  if (maxPrice < 1) {
    maxPrice = actualMaxPrice;
  }

  // Determine which sections are visible
  const sections = [
    { id: 'produkty', label: 'Produkty', visible: true },
    { id: 'o-marce', label: 'O marce', visible: !!brand.brandDescription },
    {
      id: 'galeria',
      label: 'Galeria',
      visible: !!brand.imageGallery && brand.imageGallery.length >= 4,
    },
    {
      id: 'recenzje',
      label: 'Recenzje',
      visible: !!brand.featuredReviews && brand.featuredReviews.length > 0,
    },
    { id: 'gdzie-kupic', label: 'Gdzie kupić', visible: true },
  ].filter((section) => section.visible);

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

  return (
    <main id="main" className="page-transition">
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
      <BrandStickyNav sections={sections} />
      <section id="produkty" className={`${styles.productsListing} max-width`}>
        <ProductsAside
          categories={brand.categories || []}
          brands={brand.brands || []}
          totalCount={brand.totalCount || 0}
          maxPrice={actualMaxPrice}
          basePath={`/marki/${slug}/`}
          currentCategory={categorySlug || null}
          initialSearch={searchTerm}
          initialBrands={[]}
          initialMinPrice={minPrice}
          initialMaxPrice={maxPrice}
          hideBrandFilter={true}
          useCategorySearchParam={true}
        />
        <SortDropdown
          options={PRODUCT_SORT_OPTIONS}
          basePath={`/marki/${slug}/`}
          defaultValue={hasSearchQuery ? 'orderRank' : 'newest'}
          hasSearchQuery={hasSearchQuery}
        />
        <Suspense
          key={`brand-${slug}-page-${currentPage}-search-${searchTerm}-category-${categorySlug}-sort-${sortBy}-price-${minPrice}-${maxPrice}`}
          fallback={<ProductsListingSkeleton />}
        >
          <ProductsListing
            currentPage={currentPage}
            itemsPerPage={PRODUCTS_ITEMS_PER_PAGE}
            searchTerm={searchTerm}
            category={normalizedCategory}
            sortBy={sortBy}
            brandSlug={slug}
            minPrice={minPrice}
            maxPrice={maxPrice}
            basePath={`/marki/${slug}/`}
          />
        </Suspense>
      </section>
      {brand.bannerImage && brand.bannerImage.id && (
        <section className="max-width br-md margin-bottom-lg">
          <Image
            image={brand.bannerImage}
            alt={brand.name || ''}
            className="br-md"
            sizes="(max-width: 56.1875rem) 96vw, 100vw"
            loading="lazy"
          />
        </section>
      )}
      {brand.brandDescription && brand.brandDescription.length > 0 && (
        <div id="o-marce">
          <TwoColumnContent
            content={brand.brandDescription}
            heading={`O ${brand.name}`}
            distributionYear={brand.distributionStartYear}
            distributionYearBackgroundImage={brand.bannerImage}
            gallery={brand.imageGallery}
          />
        </div>
      )}
      {/* Reviews Section */}
      {/* {brand.featuredReviews && brand.featuredReviews.length > 0 && (
        <section id="recenzje">
          <FeaturedPublications
            heading={[
              {
                _type: 'block',
                children: [{ _type: 'span', text: 'Recenzje' }],
                style: 'normal',
              },
            ]}
            publications={brand.featuredReviews}
            button={{
              text: 'Zobacz wszystkie recenzje',
              href: '/recenzje',
              variant: 'primary' as const,
              iconUsed: 'arrowRight' as const,
            }}
            index={1}
            _key=""
            _type="featuredPublications"
          />
        </section>
      )} */}

      {/* Store Locations Section */}
      {/* <section id="gdzie-kupic" className="max-width margin-bottom-sm">
        <StoreLocations />
      </section> */}
    </main>
  );
}
