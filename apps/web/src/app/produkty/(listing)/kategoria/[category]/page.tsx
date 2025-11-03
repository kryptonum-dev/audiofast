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
  PRODUCTS_ITEMS_PER_PAGE,
} from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/client';
import {
  queryCategoryMetadata,
  queryProductsPageData,
} from '@/src/global/sanity/query';
import type {
  QueryCategoryMetadataResult,
  QueryProductsPageDataResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import {
  extractRawCustomFilters,
  parseBrands,
  parsePrice,
  slugifyFilterName,
  validateCustomFilters,
} from '@/src/global/utils';

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    brands?: string | string[];
    minPrice?: string;
    maxPrice?: string;
    [key: string]: string | string[] | undefined; // Allow dynamic custom filter params
  }>;
};

export async function generateStaticParams() {
  // Fetch all categories for static generation (with default filter params)
  const productsData = await sanityFetch<QueryProductsPageDataResult>({
    query: queryProductsPageData,
    params: {
      category: '',
      search: '',
      brands: [],
      minPrice: 0,
      maxPrice: 999999999,
      customFilters: [],
    },
    tags: ['productCategorySub'],
  });

  // Only generate static pages for categories that have products
  return (
    productsData?.categories
      ?.filter((cat) => cat.count > 0)
      .map((cat) => ({
        category: cat.slug?.replace('/kategoria/', '').replace('/', '') || '',
      })) || []
  );
}

export async function generateMetadata(props: CategoryPageProps) {
  const params = await props.params;
  const categorySlug = params.category;

  const productsData = await sanityFetch<QueryProductsPageDataResult>({
    query: queryProductsPageData,
    params: {
      category: `/kategoria/${categorySlug}/`,
      search: '',
      brands: [],
      minPrice: 0,
      maxPrice: 999999999,
      customFilters: [],
    },
    tags: ['products', 'productCategorySub', categorySlug],
  });

  if (!productsData || !productsData.selectedCategory) {
    logWarn(`Category not found: ${categorySlug}`);
    return getSEOMetadata();
  }

  // Check if category has any products
  const categoryInfo = productsData.categories?.find(
    (cat) =>
      cat.slug?.replace('/kategoria/', '').replace('/', '') === categorySlug
  );

  if (!categoryInfo || categoryInfo.count === 0) {
    logWarn(`Category "${categorySlug}" has no products`);
    return getSEOMetadata();
  }

  const category = productsData.selectedCategory;

  return getSEOMetadata({
    seo: category.seo,
    slug: category.slug,
    openGraph: category.openGraph,
  });
}

export default async function CategoryPage(props: CategoryPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const categorySlug = params.category;

  // Parse search params first (before fetching data)
  const currentPage = Number(searchParams.page) || 1;
  const searchTerm = searchParams.search || '';
  const hasSearchQuery = Boolean(searchTerm);

  // Determine sortBy: if search query exists, always use 'orderRank' (relevance)
  // Otherwise use provided sortBy or default to 'newest'
  const sortBy = hasSearchQuery ? 'orderRank' : searchParams.sortBy || 'newest';

  // Parse brands early (needed for query)
  const brands = parseBrands(searchParams.brands);

  // Parse prices with initial defaults (will be validated after fetch)
  let minPrice = parsePrice(searchParams.minPrice, 0);
  let maxPrice = parsePrice(searchParams.maxPrice, 999999999, 999999999);

  // STEP 1: Lightweight fetch - Get category metadata only
  const categoryMetadata = await sanityFetch<QueryCategoryMetadataResult>({
    query: queryCategoryMetadata,
    params: {
      category: `/kategoria/${categorySlug}/`,
    },
    tags: ['productCategorySub', categorySlug],
  });

  if (!categoryMetadata) {
    logWarn(`Category not found: ${categorySlug}, returning 404`);
    notFound();
  }

  // Extract raw custom filters from URL
  const rawCustomFilters = extractRawCustomFilters(searchParams);

  // Validate custom filters against category's available filters
  const availableFilters = categoryMetadata.customFilters || [];
  const customFilters = validateCustomFilters(
    rawCustomFilters,
    availableFilters
  );

  // STEP 2: Main fetch - Get all data with validated filters
  const productsData = await sanityFetch<QueryProductsPageDataResult>({
    query: queryProductsPageData,
    params: {
      category: `/kategoria/${categorySlug}/`,
      search: searchTerm,
      brands,
      minPrice,
      maxPrice,
      customFilters,
    },
    tags: ['products', 'productCategorySub', 'product', 'brand', categorySlug],
  });

  if (!productsData || !productsData.selectedCategory) {
    logWarn(`Category page data not found for: ${categorySlug}, returning 404`);
    notFound();
  }

  const category = productsData.selectedCategory;

  // Build current search params for CustomFiltersBar (with validated filters)
  const currentSearchParams = new URLSearchParams();
  if (searchTerm) currentSearchParams.set('search', searchTerm);
  if (brands.length > 0) currentSearchParams.set('brands', brands.join(','));
  if (minPrice > 0) currentSearchParams.set('minPrice', minPrice.toString());
  if (maxPrice < 999999999)
    currentSearchParams.set('maxPrice', maxPrice.toString());
  customFilters.forEach((filter) => {
    const slugified = slugifyFilterName(filter.filterName);
    currentSearchParams.set(slugified, filter.value);
  });

  // Get the actual maximum price from filtered products
  // If no products match filters, maxPrice will be null, so fallback to a default
  const actualMaxPrice = productsData.maxPrice ?? 100000;
  const actualMinPrice = productsData.minPrice ?? 0;

  // Validate and adjust price range based on filtered results
  if (minPrice > actualMaxPrice) {
    minPrice = actualMinPrice;
  }
  if (maxPrice > actualMaxPrice) {
    maxPrice = actualMaxPrice;
  }
  if (maxPrice < 1) {
    maxPrice = actualMaxPrice;
  }

  // Check if category exists in the system (not just filtered results)
  // We don't check count here - if filters result in 0 products, show empty state instead of 404
  const categoryExists = productsData.categoriesAll?.some(
    (cat) =>
      cat.slug?.replace('/kategoria/', '').replace('/', '') === categorySlug
  );

  if (!categoryExists) {
    logWarn(`Category "${categorySlug}" does not exist, returning 404`);
    notFound();
  }

  const breadcrumbsData = [
    {
      name: productsData.name || 'Produkty',
      path: '/produkty/',
    },
    {
      name: category.name || categorySlug,
      path: category.slug || `/produkty/kategoria/${categorySlug}/`,
    },
  ];

  // Use category's custom title/description/image if available, otherwise fall back to main products page
  const heroTitle = category.title || productsData.title;
  const heroDescription = category.description || productsData.description;
  const heroImage = category.heroImage || productsData.heroImage;

  // Use category's page builder if available, otherwise fallback to main products page
  const pageBuilderSections = category.pageBuilder?.length
    ? category.pageBuilder
    : productsData.pageBuilder || [];

  // Process available filter values into grouped format
  // For each filter, show only values that exist in products matching OTHER active filters
  const processedFilterValues = availableFilters
    .map((filterName) => {
      // Get OTHER active custom filters (exclude the one we're calculating)
      const otherActiveFilters = customFilters.filter(
        (f) => f.filterName !== filterName
      );

      // Filter products that match OTHER active custom filters
      const matchingProducts =
        category.productsWithFilters?.filter((product) => {
          if (!product.customFilterValues) return false;

          // Check if this product has all OTHER active filters
          return otherActiveFilters.every((activeFilter) => {
            return product.customFilterValues?.some(
              (pf) =>
                pf.filterName === activeFilter.filterName &&
                pf.value === activeFilter.value
            );
          });
        }) || [];

      // Get unique values for the current filter from matching products
      const values = Array.from(
        new Set(
          matchingProducts.flatMap(
            (product) =>
              product.customFilterValues
                ?.filter((fv) => fv.filterName === filterName)
                .map((fv) => fv.value)
                .filter(Boolean) || []
          )
        )
      ).sort();

      return {
        name: filterName,
        values,
      };
    })
    .filter((filter) => filter.values.length > 0);

  return (
    <>
      <CollectionPageSchema
        name={category.name || categorySlug}
        url={`/produkty/kategoria/${categorySlug}/`}
        description={category.description || productsData.description}
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
        _key={''}
        _type={'heroStatic'}
        button={null}
      />

      <section
        className={`${styles.productsListing} max-width`}
        data-has-filters={processedFilterValues.length > 0}
      >
        <ProductsAside
          categories={productsData.categoriesAll || []}
          brands={productsData.brands || []}
          totalCount={productsData.totalCountAll || 0}
          maxPrice={actualMaxPrice}
          basePath={`/produkty/kategoria/${categorySlug}/`}
          currentCategory={categorySlug}
          initialSearch={searchTerm}
          initialBrands={brands}
          initialMinPrice={minPrice}
          initialMaxPrice={maxPrice}
        />
        <CustomFiltersBar
          customFilters={processedFilterValues}
          activeFilters={customFilters}
          basePath={`/produkty/kategoria/${categorySlug}/`}
          currentSearchParams={currentSearchParams}
        />
        <SortDropdown
          options={PRODUCT_SORT_OPTIONS}
          basePath={`/produkty/kategoria/${categorySlug}/`}
          defaultValue={hasSearchQuery ? 'orderRank' : 'newest'}
          hasSearchQuery={hasSearchQuery}
        />
        <Suspense
          key={`category-${categorySlug}-page-${currentPage}-search-${searchTerm}-sort-${sortBy}-brands-${brands.join(',')}-price-${minPrice}-${maxPrice}-filters-${JSON.stringify(customFilters)}`}
          fallback={<ProductsListingSkeleton />}
        >
          <ProductsListing
            currentPage={currentPage}
            itemsPerPage={PRODUCTS_ITEMS_PER_PAGE}
            searchTerm={searchTerm}
            category={`/kategoria/${categorySlug}/`}
            sortBy={sortBy}
            brands={brands}
            minPrice={minPrice}
            maxPrice={maxPrice}
            customFilters={customFilters}
            basePath={`/produkty/kategoria/${categorySlug}/`}
          />
        </Suspense>
      </section>

      <PageBuilder pageBuilder={pageBuilderSections} />
    </>
  );
}
