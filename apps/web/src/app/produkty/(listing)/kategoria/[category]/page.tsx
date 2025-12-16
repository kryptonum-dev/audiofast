import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import CustomFiltersBar from '@/src/components/products/CustomFiltersBar';
import ProductsAside from '@/src/components/products/ProductsAside';
import ProductsListing from '@/src/components/products/ProductsListing';
import ProductsListingSkeleton from '@/src/components/products/ProductsListing/ProductsListingSkeleton';
import styles from '@/src/components/products/ProductsListing/styles.module.scss';
import SortDropdown from '@/src/components/products/SortDropdown';
import CollectionPageSchema from '@/src/components/schema/CollectionPageSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import {
  PRODUCT_SORT_OPTIONS,
  RELEVANCE_SORT_OPTION,
} from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import {
  queryAllProductsFilterMetadata,
  queryProductsPageContent,
} from '@/src/global/sanity/query';
import type {
  QueryAllProductsFilterMetadataResult,
  QueryProductsPageContentResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import {
  extractRawCustomFilters,
  slugifyFilterName,
  validateCustomFilters,
} from '@/src/global/utils';

// Type for category content (GROQ select() returns this or null)
// Generated types incorrectly infer `null` - this extends the default content type
type CategoryContentType = NonNullable<
  QueryProductsPageContentResult['defaultContent']
> & {
  customFilters?: string[];
  parentCategory?: {
    _id: string;
    name: string | null;
    slug: string | null;
  } | null;
};

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    brands?: string | string[];
    minPrice?: string;
    maxPrice?: string;
    [key: string]: string | string[] | undefined;
  }>;
};

// ----------------------------------------
// Cached Static Data Fetchers
// ----------------------------------------

// Shared filter metadata (same for all category pages)
async function getStaticFilterMetadata() {
  'use cache';
  cacheLife('hours');

  return sanityFetch<QueryAllProductsFilterMetadataResult>({
    query: queryAllProductsFilterMetadata,
    tags: ['products'],
  });
}

// Page content (handles both default and category-specific content)
async function getPageContent(categorySlug: string) {
  'use cache';
  cacheLife('hours');

  return sanityFetch<QueryProductsPageContentResult>({
    query: queryProductsPageContent,
    params: { category: `/kategoria/${categorySlug}/` },
    tags: ['products', 'productCategorySub'],
  });
}

// ----------------------------------------
// Static Params Generation
// ----------------------------------------
export async function generateStaticParams() {
  const filterMetadata = await getStaticFilterMetadata();

  return (
    filterMetadata?.categories
      ?.filter((cat) => cat.slug)
      .map((cat) => ({
        category: cat.slug?.replace('/kategoria/', '').replace(/\/$/, '') || '',
      })) || []
  );
}

// ----------------------------------------
// Metadata Generation
// ----------------------------------------
export async function generateMetadata({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const contentData = await getPageContent(categorySlug);

  const pageData = contentData?.categoryContent || contentData?.defaultContent;

  if (!pageData) {
    logWarn(`Category not found: ${categorySlug}`);
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
  });
}

// ----------------------------------------
// Page Component
// ----------------------------------------
export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const searchParamsData = await searchParams;

  // Fetch all cached static data in parallel
  const [contentData, filterMetadata] = await Promise.all([
    getPageContent(categorySlug),
    getStaticFilterMetadata(),
  ]);

  const defaultContent = contentData?.defaultContent;
  // Cast categoryContent - GROQ select() type is incorrectly inferred as `null`
  const categoryContent =
    contentData?.categoryContent as CategoryContentType | null;

  if (!defaultContent || !filterMetadata) {
    logWarn(`Category page data not found for: ${categorySlug}`);
    notFound();
  }

  // Check if category exists
  const categoryExists = filterMetadata.categories?.some(
    (cat) => cat.slug === `/kategoria/${categorySlug}/`,
  );

  if (!categoryExists) {
    logWarn(`Category "${categorySlug}" does not exist`);
    notFound();
  }

  // Use category content if available, otherwise fallback to default
  const heroTitle = categoryContent?.title || defaultContent.title;
  const heroDescription =
    categoryContent?.description || defaultContent.description;
  const heroImage = categoryContent?.heroImage || defaultContent.heroImage;
  const pageBuilderSections =
    categoryContent?.pageBuilder && categoryContent.pageBuilder.length > 0
      ? categoryContent.pageBuilder
      : defaultContent.pageBuilder || [];

  // Available custom filters for this category
  const availableCustomFilters = categoryContent?.customFilters || [];

  // Parse custom filters from URL for CustomFiltersBar
  const rawCustomFilters = extractRawCustomFilters(searchParamsData);
  const activeCustomFilters = validateCustomFilters(
    rawCustomFilters,
    availableCustomFilters,
  );

  // Build current search params for CustomFiltersBar
  const currentSearchParams = new URLSearchParams();
  if (searchParamsData.search)
    currentSearchParams.set('search', String(searchParamsData.search));
  if (searchParamsData.brands)
    currentSearchParams.set(
      'brands',
      Array.isArray(searchParamsData.brands)
        ? searchParamsData.brands.join(',')
        : searchParamsData.brands,
    );
  if (searchParamsData.minPrice)
    currentSearchParams.set('minPrice', String(searchParamsData.minPrice));
  if (searchParamsData.maxPrice)
    currentSearchParams.set('maxPrice', String(searchParamsData.maxPrice));
  activeCustomFilters.forEach((filter) => {
    currentSearchParams.set(slugifyFilterName(filter.filterName), filter.value);
  });

  // Process available filter values from products metadata
  const processedFilterValues = availableCustomFilters
    .map((filterName: string) => {
      // Get products in this category
      const categoryProducts =
        filterMetadata.products?.filter((p) =>
          p.allCategorySlugs?.includes(`/kategoria/${categorySlug}/`),
        ) || [];

      // Get unique values for this filter
      const values = Array.from(
        new Set(
          categoryProducts.flatMap(
            (product) =>
              product.customFilterValues
                ?.filter((fv) => fv?.filterName === filterName)
                .map((fv) => fv?.value)
                .filter(Boolean) || [],
          ),
        ),
      ).sort() as string[];

      return {
        name: filterName,
        values,
      };
    })
    .filter(
      (filter: { name: string; values: string[] }) => filter.values.length > 0,
    );

  const breadcrumbsData = [
    {
      name: defaultContent.name || 'Produkty',
      path: '/produkty/',
    },
    {
      name: categoryContent?.name || categorySlug,
      path: categoryContent?.slug || `/produkty/kategoria/${categorySlug}/`,
    },
  ];

  return (
    <>
      <CollectionPageSchema
        name={categoryContent?.name || categorySlug}
        url={`/produkty/kategoria/${categorySlug}/`}
        description={categoryContent?.description || defaultContent.description}
      />
      <Breadcrumbs data={breadcrumbsData} firstItemType="heroStatic" />
      <HeroStatic
        heading={heroTitle!}
        description={heroDescription!}
        image={heroImage}
        showBlocks={false}
        blocksHeading={null}
        blocks={[]}
        index={0}
        _key=""
        _type="heroStatic"
        button={null}
      />

      <section
        className={`${styles.productsListing} max-width`}
        data-has-filters={processedFilterValues.length > 0}
      >
        {/* Client-side computed sidebar */}
        <ProductsAside
          allProductsMetadata={filterMetadata.products || []}
          allCategories={filterMetadata.categories || []}
          allBrands={filterMetadata.brands || []}
          globalMaxPrice={filterMetadata.globalMaxPrice || 100000}
          basePath={`/produkty/kategoria/${categorySlug}/`}
          currentCategory={`/kategoria/${categorySlug}/`}
          headingLevel="h2"
        />

        {/* Custom filters bar (for categories with custom filters) */}
        {processedFilterValues.length > 0 && (
          <CustomFiltersBar
            customFilters={processedFilterValues}
            activeFilters={activeCustomFilters}
            basePath={`/produkty/kategoria/${categorySlug}/`}
            currentSearchParams={currentSearchParams}
          />
        )}

        <SortDropdown
          options={[RELEVANCE_SORT_OPTION, ...PRODUCT_SORT_OPTIONS]}
          basePath={`/produkty/kategoria/${categorySlug}/`}
          defaultValue="newest"
        />

        {/* Products listing in Suspense */}
        <Suspense fallback={<ProductsListingSkeleton />}>
          <ProductsListing
            searchParams={searchParams}
            basePath={`/produkty/kategoria/${categorySlug}/`}
            category={`/kategoria/${categorySlug}/`}
            availableCustomFilters={availableCustomFilters}
            defaultSortBy="newest"
          />
        </Suspense>
      </section>

      <PageBuilder pageBuilder={pageBuilderSections} />
    </>
  );
}
