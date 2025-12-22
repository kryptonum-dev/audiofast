import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import CustomFiltersBar from '@/src/components/products/CustomFiltersBar';
import ProductsAside from '@/src/components/products/ProductsAside';
import ProductsListing from '@/src/components/products/ProductsListing';
import ProductsListingSkeleton from '@/src/components/products/ProductsListing/ProductsListingSkeleton';
import styles from '@/src/components/products/ProductsListing/styles.module.scss';
import ProductsListingContainer from '@/src/components/products/ProductsListingContainer';
import { ProductsLoadingProvider } from '@/src/components/products/ProductsLoadingContext';
import SortDropdown from '@/src/components/products/SortDropdown';
import CollectionPageSchema from '@/src/components/schema/CollectionPageSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import {
  PRODUCT_SORT_OPTIONS,
  RELEVANCE_SORT_OPTION,
} from '@/src/global/constants';
import {
  type ActiveFilters,
  computeAvailableFilters,
  type CustomFilterDefinition,
} from '@/src/global/filters';
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
  parseBrands,
  parsePrice,
  parseRangeFilters,
  slugifyFilterName,
  validateCustomFilters,
} from '@/src/global/utils';

// Type for category content (GROQ select() returns this or null)
// Generated types incorrectly infer `null` - this extends the default content type
type CategoryContentType = NonNullable<
  QueryProductsPageContentResult['defaultContent']
> & {
  customFilters?: Array<{
    _key: string;
    name: string;
    filterType: 'dropdown' | 'range';
    unit?: string;
  }>;
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

  // ----------------------------------------
  // Custom Filters Processing
  // ----------------------------------------

  // Get filter definitions from category (with filterType and unit)
  // Filter out null/incomplete filter items (empty filters in Sanity, deleted items, etc.)
  const filterDefinitions: CustomFilterDefinition[] =
    categoryContent?.customFilters
      ?.filter(
        (f): f is NonNullable<typeof f> =>
          f !== null && !!f._key && !!f.name && !!f.filterType,
      )
      ?.map((f) => ({
        _key: f._key,
        name: f.name,
        filterType: f.filterType,
        unit: f.unit,
      })) || [];

  // Get dropdown filter names for backward compatibility
  const dropdownFilterNames = filterDefinitions
    .filter((f) => f.filterType === 'dropdown')
    .map((f) => f.name);

  // Parse dropdown filters from URL
  const rawCustomFilters = extractRawCustomFilters(searchParamsData);
  const activeCustomFilters = validateCustomFilters(
    rawCustomFilters,
    dropdownFilterNames,
  );

  // Build URLSearchParams for parsing range filters
  const urlSearchParams = new URLSearchParams();
  Object.entries(searchParamsData).forEach(([key, value]) => {
    if (value !== undefined) {
      const stringValue = Array.isArray(value) ? value[0] : value;
      if (stringValue) {
        urlSearchParams.set(key, stringValue);
      }
    }
  });

  // Parse range filters from URL
  const activeRangeFilters = parseRangeFilters(
    urlSearchParams,
    filterDefinitions,
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

  // Add dropdown filter params
  activeCustomFilters.forEach((filter) => {
    currentSearchParams.set(slugifyFilterName(filter.filterName), filter.value);
  });

  // Add range filter params (format: {slug}-min, {slug}-max)
  activeRangeFilters.forEach((rf) => {
    const slug = slugifyFilterName(rf.filterName);
    if (rf.minValue !== undefined) {
      currentSearchParams.set(`${slug}-min`, rf.minValue.toString());
    }
    if (rf.maxValue !== undefined) {
      currentSearchParams.set(`${slug}-max`, rf.maxValue.toString());
    }
  });

  // ----------------------------------------
  // Compute Filter Options (client-side style, but on server)
  // ----------------------------------------

  // Parse sidebar filters from URL
  const brandsParam = searchParamsData.brands;
  const activeBrands = brandsParam
    ? parseBrands(Array.isArray(brandsParam) ? brandsParam[0] : brandsParam)
    : [];
  const activeMinPrice = parsePrice(
    searchParamsData.minPrice
      ? String(
          Array.isArray(searchParamsData.minPrice)
            ? searchParamsData.minPrice[0]
            : searchParamsData.minPrice,
        )
      : undefined,
    0,
  );
  const activeMaxPrice = parsePrice(
    searchParamsData.maxPrice
      ? String(
          Array.isArray(searchParamsData.maxPrice)
            ? searchParamsData.maxPrice[0]
            : searchParamsData.maxPrice,
        )
      : undefined,
    Infinity,
    Infinity,
  );

  // Build active filters for computation (includes sidebar filters)
  const activeFiltersForComputation: ActiveFilters = {
    search: '',
    brands: activeBrands,
    minPrice: activeMinPrice,
    maxPrice: activeMaxPrice,
    category: `/kategoria/${categorySlug}/`,
    customFilters: activeCustomFilters.map((f) => ({
      filterName: f.filterName,
      value: f.value,
    })),
    rangeFilters: activeRangeFilters,
    isCPO: false,
  };

  // Compute available filters (this gives us dropdown values and range bounds)
  const computedFilters = computeAvailableFilters(
    filterMetadata.products || [],
    activeFiltersForComputation,
  );

  // Process dropdown filter values from computed filters
  const processedFilterValues = filterDefinitions
    .filter((def) => def.filterType === 'dropdown')
    .map((def) => {
      const values = computedFilters.customFilterValues.get(def.name) || [];
      return {
        name: def.name,
        values: values.sort(),
      };
    })
    .filter((filter) => filter.values.length > 0);

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

      <ProductsLoadingProvider>
        <section
          className={`${styles.productsListing} max-width`}
          data-has-filters={filterDefinitions.length > 0}
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
            filterDefinitions={filterDefinitions}
          />

          {/* Custom filters bar (for categories with custom filters) */}
          {filterDefinitions.length > 0 && (
            <CustomFiltersBar
              filterDefinitions={filterDefinitions}
              customFilters={processedFilterValues}
              activeFilters={activeCustomFilters}
              activeRangeFilters={activeRangeFilters}
              rangeFilterBounds={computedFilters.rangeFilterBounds}
              basePath={`/produkty/kategoria/${categorySlug}/`}
              currentSearchParams={currentSearchParams}
            />
          )}

          <SortDropdown
            options={[RELEVANCE_SORT_OPTION, ...PRODUCT_SORT_OPTIONS]}
            basePath={`/produkty/kategoria/${categorySlug}/`}
            defaultValue="newest"
          />

          {/* Products listing - container shows overlay skeleton on filter changes */}
          <ProductsListingContainer>
            <Suspense fallback={<ProductsListingSkeleton />}>
              <ProductsListing
                searchParams={searchParams}
                basePath={`/produkty/kategoria/${categorySlug}/`}
                category={`/kategoria/${categorySlug}/`}
                availableCustomFilters={dropdownFilterNames}
                filterDefinitions={filterDefinitions}
                defaultSortBy="newest"
              />
            </Suspense>
          </ProductsListingContainer>
        </section>
      </ProductsLoadingProvider>

      <PageBuilder pageBuilder={pageBuilderSections} />
    </>
  );
}
