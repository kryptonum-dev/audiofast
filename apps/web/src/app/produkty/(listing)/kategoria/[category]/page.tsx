import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { stegaClean } from 'next-sanity';
import { type ReactNode, Suspense } from 'react';

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
import { limitBuildTimeStaticParams } from '@/src/global/build';
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
import { getProductsFilterMetadata } from '@/src/global/products/filter-metadata';
import {
  type CachedProps,
  renderDraftAware,
} from '@/src/global/sanity/draft-aware';
import {
  type DynamicFetchOptions,
  getDynamicFetchOptions,
  PUBLISHED,
  sanityFetchCached,
  sanityFetchStaticParams,
} from '@/src/global/sanity/live';
import {
  queryAllProductCategorySlugs,
  queryProductsPageContent,
} from '@/src/global/sanity/query';
import type {
  QueryAllProductCategorySlugsResult,
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
  doNotIndex?: boolean | null;
};

type CategorySearchParams = {
  page?: string;
  search?: string;
  sortBy?: string;
  brands?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  [key: string]: string | string[] | undefined;
};

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<CategorySearchParams>;
};

// ----------------------------------------
// Shared cached data + pure helpers
// ----------------------------------------

// Page content (handles both default and category-specific content). One
// cached entry per (category, perspective, stega): metadata and the published
// shell share the PUBLISHED entry; the listing slots read it with stega off.
function getCategoryPageContent(
  categorySlug: string,
  options: DynamicFetchOptions,
) {
  return sanityFetchCached<QueryProductsPageContentResult>({
    requestTag: 'products.category.content',
    query: queryProductsPageContent,
    params: { category: `/kategoria/${categorySlug}/` },
    ...options,
  });
}

// Filter definitions drive URL param names (`slugifyFilterName`) and GROQ
// params, so they must never carry stega markers: `stegaClean` before they
// leave the draft-capable read.
function getFilterDefinitions(
  categoryContent: CategoryContentType | null,
): CustomFilterDefinition[] {
  // Filter out null/incomplete filter items (empty filters in Sanity, deleted items, etc.)
  return stegaClean(
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
      })) || [],
  );
}

function getDropdownFilterNames(filterDefinitions: CustomFilterDefinition[]) {
  return filterDefinitions
    .filter((f) => f.filterType === 'dropdown')
    .map((f) => f.name);
}

// The listing slots' own read: logic data, so always stega off.
async function getListingCategoryData(categorySlug: string) {
  const { perspective } = await getDynamicFetchOptions();
  const contentData = await getCategoryPageContent(categorySlug, {
    perspective,
    stega: false,
  });
  const categoryContent =
    contentData?.categoryContent as CategoryContentType | null;
  return {
    perspective,
    filterDefinitions: getFilterDefinitions(categoryContent),
  };
}

// ----------------------------------------
// Static Params Generation
// ----------------------------------------
export async function generateStaticParams() {
  const categories =
    await sanityFetchStaticParams<QueryAllProductCategorySlugsResult>({
      requestTag: 'products.category.static-params',
      query: queryAllProductCategorySlugs,
    });

  return limitBuildTimeStaticParams(
    categories
      .filter((cat) => cat.slug)
      .map((cat) => ({
        category: cat.slug!.replace('/kategoria/', '').replace(/\/$/, ''),
      })),
    { category: '__placeholder__' },
  );
}

// ----------------------------------------
// Metadata Generation
// ----------------------------------------
export async function generateMetadata({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const contentData = await getCategoryPageContent(categorySlug, PUBLISHED);

  const categoryContent =
    contentData?.categoryContent as unknown as CategoryContentType | null;
  const pageData = categoryContent || contentData?.defaultContent;

  if (!pageData) {
    logWarn(`Category not found: ${categorySlug}`);
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: `/produkty${pageData.slug}`,
    openGraph: pageData.openGraph,
    noNotIndex: categoryContent?.doNotIndex,
  });
}

// ----------------------------------------
// Page Component (orchestrator)
// ----------------------------------------
export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category: categorySlug } = await params;

  // Pass-through slots (shape B): the two searchParams-driven parts are built
  // here, outside every cache scope, and handed to the cached shell untouched,
  // so the shell (hero, sidebar, filter metadata, PageBuilder) prerenders.
  const filtersBar = (
    <Suspense fallback={null}>
      <CategoryFiltersBar
        categorySlug={categorySlug}
        searchParams={searchParams}
      />
    </Suspense>
  );
  const listing = (
    <Suspense fallback={<ProductsListingSkeleton />}>
      <CategoryListing
        categorySlug={categorySlug}
        searchParams={searchParams}
      />
    </Suspense>
  );

  return renderDraftAware(CachedCategoryShell, {
    categorySlug,
    filtersBar,
    listing,
  });
}

// ----------------------------------------
// Request-time slots
// ----------------------------------------
async function CategoryListing({
  categorySlug,
  searchParams,
}: {
  categorySlug: string;
  searchParams: Promise<CategorySearchParams>;
}) {
  const { filterDefinitions } = await getListingCategoryData(categorySlug);

  return (
    <ProductsListing
      searchParams={searchParams}
      basePath={`/produkty/kategoria/${categorySlug}/`}
      category={`/kategoria/${categorySlug}/`}
      availableCustomFilters={getDropdownFilterNames(filterDefinitions)}
      filterDefinitions={filterDefinitions}
      defaultSortBy="priceAsc"
    />
  );
}

// Custom filters bar (for categories with custom filters): its active state
// and computed values depend on the request's search params.
async function CategoryFiltersBar({
  categorySlug,
  searchParams,
}: {
  categorySlug: string;
  searchParams: Promise<CategorySearchParams>;
}) {
  const [searchParamsData, { perspective, filterDefinitions }] =
    await Promise.all([searchParams, getListingCategoryData(categorySlug)]);

  if (filterDefinitions.length === 0) {
    return null;
  }

  const filterMetadata = await getProductsFilterMetadata(perspective);
  const dropdownFilterNames = getDropdownFilterNames(filterDefinitions);

  // ----------------------------------------
  // Custom Filters Processing
  // ----------------------------------------

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
  };

  // Compute available filters (this gives us dropdown values and range bounds)
  const computedFilters = computeAvailableFilters(
    filterMetadata?.products || [],
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

  return (
    <CustomFiltersBar
      filterDefinitions={filterDefinitions}
      customFilters={processedFilterValues}
      activeFilters={activeCustomFilters}
      activeRangeFilters={activeRangeFilters}
      rangeFilterBounds={computedFilters.rangeFilterBounds}
      basePath={`/produkty/kategoria/${categorySlug}/`}
      currentSearchParams={currentSearchParams}
    />
  );
}

// ----------------------------------------
// Cached shell
// ----------------------------------------
async function CachedCategoryShell({
  categorySlug,
  filtersBar,
  listing,
  perspective,
  stega,
  isDraft,
}: CachedProps & {
  categorySlug: string;
  filtersBar: ReactNode;
  listing: ReactNode;
}) {
  'use cache';
  cacheLife('sanity');

  const [contentData, filterMetadata] = await Promise.all([
    getCategoryPageContent(categorySlug, { perspective, stega }),
    getProductsFilterMetadata(perspective),
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
  const usesCategoryBlocks = Boolean(
    categoryContent?.pageBuilder && categoryContent.pageBuilder.length > 0,
  );
  const pageBuilderSections =
    usesCategoryBlocks && categoryContent?.pageBuilder
      ? categoryContent.pageBuilder
      : defaultContent.pageBuilder || [];
  // The overlay must address the document whose blocks are rendered.
  const pageBuilderOwner = usesCategoryBlocks
    ? { _id: categoryContent?._id, _type: 'productCategorySub' }
    : { _id: defaultContent._id, _type: defaultContent._type };

  const filterDefinitions = getFilterDefinitions(categoryContent);

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

          {/* Custom filters bar (request-time slot, renders nothing for
              categories without custom filters) */}
          {filtersBar}

          <SortDropdown
            options={[RELEVANCE_SORT_OPTION, ...PRODUCT_SORT_OPTIONS]}
            basePath={`/produkty/kategoria/${categorySlug}/`}
            defaultValue="priceAsc"
          />

          {/* Products listing - container shows overlay skeleton on filter changes */}
          <ProductsListingContainer>{listing}</ProductsListingContainer>
        </section>
      </ProductsLoadingProvider>

      <PageBuilder
        pageBuilder={pageBuilderSections}
        fetchOptions={{ perspective, stega }}
        documentId={pageBuilderOwner._id}
        documentType={pageBuilderOwner._type}
        isDraft={isDraft}
      />
    </>
  );
}
