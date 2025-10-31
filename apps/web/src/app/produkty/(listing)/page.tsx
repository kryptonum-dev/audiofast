import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
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
import { queryProductsPageData } from '@/src/global/sanity/query';
import type { QueryProductsPageDataResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import { parseBrands, parsePrice } from '@/src/global/utils';

type ProductsPageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    brands?: string | string[];
    minPrice?: string;
    maxPrice?: string;
  }>;
};

export async function generateMetadata() {
  const productsData = await sanityFetch<QueryProductsPageDataResult>({
    query: queryProductsPageData,
    params: { category: '' },
    tags: ['products'],
  });

  if (!productsData) {
    logWarn('Products page data not found');
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: productsData.seo,
    slug: productsData.slug,
    openGraph: productsData.openGraph,
  });
}

export default async function ProductsPage(props: ProductsPageProps) {
  const searchParams = await props.searchParams;

  // Fetch products data first to get the real maxPrice
  const productsData = await sanityFetch<QueryProductsPageDataResult>({
    query: queryProductsPageData,
    params: { category: '' },
    tags: ['products', 'productCategorySub', 'product'],
  });

  if (!productsData) {
    logWarn('Products page data not found');
    notFound();
  }

  // Get the actual maximum price from all products
  const actualMaxPrice = productsData.maxPrice!;

  // Parse search params with validation
  const currentPage = Number(searchParams.page) || 1;
  const searchTerm = searchParams.search || '';
  const hasSearchQuery = Boolean(searchTerm);

  // Determine sortBy: if search query exists, always use 'orderRank' (relevance)
  // Otherwise use provided sortBy or default to 'newest'
  const sortBy = hasSearchQuery ? 'orderRank' : searchParams.sortBy || 'newest';

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

  const brands = parseBrands(searchParams.brands);

  const breadcrumbsData = [
    {
      name: productsData.name || 'Produkty',
      path: '/produkty/',
    },
  ];

  return (
    <>
      <CollectionPageSchema
        name={productsData.name || 'Produkty'}
        url="/produkty/"
        description={productsData.description}
      />
      <Breadcrumbs data={breadcrumbsData} firstItemType="heroStatic" />
      <HeroStatic
        heading={productsData.title!}
        description={productsData.description!}
        image={productsData.heroImage!}
        showBlocks={false}
        blocksHeading={null}
        blocks={[]}
        index={0}
        _key={''}
        _type={'heroStatic'}
        button={null}
      />
      <section className={`${styles.productsListing} max-width`}>
        <ProductsAside
          categories={productsData.categories || []}
          brands={productsData.brands || []}
          totalCount={productsData.totalCount || 0}
          maxPrice={actualMaxPrice}
          basePath="/produkty/"
          currentCategory={null}
          initialSearch={searchTerm}
          initialBrands={brands}
          initialMinPrice={minPrice}
          initialMaxPrice={maxPrice}
        />
        <SortDropdown
          options={PRODUCT_SORT_OPTIONS}
          basePath="/produkty/"
          defaultValue={hasSearchQuery ? 'orderRank' : 'newest'}
          hasSearchQuery={hasSearchQuery}
        />
        <Suspense
          key={`page-${currentPage}-search-${searchTerm}-sort-${sortBy}-brands-${brands.join(',')}-price-${minPrice}-${maxPrice}`}
          fallback={<ProductsListingSkeleton />}
        >
          <ProductsListing
            currentPage={currentPage}
            itemsPerPage={PRODUCTS_ITEMS_PER_PAGE}
            searchTerm={searchTerm}
            category=""
            sortBy={sortBy}
            brands={brands}
            minPrice={minPrice}
            maxPrice={maxPrice}
            basePath="/produkty/"
          />
        </Suspense>
      </section>
      <PageBuilder pageBuilder={productsData.pageBuilder || []} />
    </>
  );
}
