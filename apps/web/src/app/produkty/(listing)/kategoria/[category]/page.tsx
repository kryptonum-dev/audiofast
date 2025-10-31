import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import ProductsListing from '@/src/components/products/ProductsListing';
import ProductsListingSkeleton from '@/src/components/products/ProductsListing/ProductsListingSkeleton';
import styles from '@/src/components/products/ProductsListing/styles.module.scss';
import CollectionPageSchema from '@/src/components/schema/CollectionPageSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { PRODUCTS_ITEMS_PER_PAGE } from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/client';
import { queryProductsPageData } from '@/src/global/sanity/query';
import type { QueryProductsPageDataResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import {
  extractCustomFilters,
  parseBrands,
  parsePrice,
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
  // Fetch all categories for static generation
  const productsData = await sanityFetch<QueryProductsPageDataResult>({
    query: queryProductsPageData,
    params: { category: '' },
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
    params: { category: `/kategoria/${categorySlug}/` },
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

  // Parse standard search params
  const currentPage = Number(searchParams.page) || 1;
  const searchTerm = searchParams.search || '';
  const sortBy = searchParams.sortBy || 'newest';
  const brands = parseBrands(searchParams.brands);

  const productsData = await sanityFetch<QueryProductsPageDataResult>({
    query: queryProductsPageData,
    params: { category: `/kategoria/${categorySlug}/` },
    tags: ['products', 'productCategorySub', 'product', categorySlug],
  });

  if (!productsData || !productsData.selectedCategory) {
    logWarn(`Category page data not found for: ${categorySlug}, returning 404`);
    notFound();
  }

  const category = productsData.selectedCategory;

  // Get the actual maximum price for this category
  const actualMaxPrice = productsData.maxPrice!;

  // Parse and validate prices with edge case handling
  let minPrice = parsePrice(searchParams.minPrice, 0);
  let maxPrice = parsePrice(
    searchParams.maxPrice,
    actualMaxPrice,
    actualMaxPrice
  );

  // Edge case 1: If minPrice > maxPrice, reset both to defaults
  if (minPrice > maxPrice) {
    minPrice = 0;
    maxPrice = actualMaxPrice;
  }

  // Edge case 2: maxPrice must be at least 1
  if (maxPrice < 1) {
    maxPrice = 1;
  }

  // Get available filter names from category for matching slugified URL params
  const availableFilters = category.customFilters || [];

  // Extract custom filters (dynamic params like "liczba-wejsc=5", "impedancja=8", etc.)
  // Matches slugified URL params back to original filter names
  console.log(availableFilters);
  const customFilters = extractCustomFilters(searchParams, availableFilters);

  // Check if category has any products
  const categoryInfo = productsData.categories?.find(
    (cat) =>
      cat.slug?.replace('/kategoria/', '').replace('/', '') === categorySlug
  );

  if (!categoryInfo || categoryInfo.count === 0) {
    logWarn(`Category "${categorySlug}" has no products, returning 404`);
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

      <section className={`${styles.productsGrid} max-width`}>
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
