import { cacheLife } from 'next/cache';
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

// ----------------------------------------
// Cached Static Data Fetcher
// ----------------------------------------
async function getStaticPageData() {
  'use cache';
  cacheLife('weeks');

  const [contentData, filterMetadata] = await Promise.all([
    sanityFetch<QueryProductsPageContentResult>({
      query: queryProductsPageContent,
      params: { category: '' },
      tags: ['products'],
    }),
    sanityFetch<QueryAllProductsFilterMetadataResult>({
      query: queryAllProductsFilterMetadata,
      tags: ['products'],
    }),
  ]);

  return { contentData, filterMetadata };
}

// ----------------------------------------
// Metadata Generation
// ----------------------------------------
export async function generateMetadata() {
  const { contentData } = await getStaticPageData();
  const pageData = contentData?.defaultContent;

  if (!pageData) {
    logWarn('Products page data not found');
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
export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  // Fetch cached static data (instant after first load)
  const { contentData, filterMetadata } = await getStaticPageData();
  const pageData = contentData?.defaultContent;

  if (!pageData || !filterMetadata) {
    logWarn('Products page data not found');
    notFound();
  }

  const breadcrumbsData = [
    {
      name: pageData.name || 'Produkty',
      path: '/produkty/',
    },
  ];

  return (
    <>
      <CollectionPageSchema
        name={pageData.name || 'Produkty'}
        url="/produkty/"
        description={pageData.description}
      />
      <Breadcrumbs data={breadcrumbsData} firstItemType="heroStatic" />
      <HeroStatic
        heading={pageData.title!}
        description={pageData.description!}
        image={pageData.heroImage!}
        showBlocks={false}
        blocksHeading={null}
        blocks={[]}
        index={0}
        _key=""
        _type="heroStatic"
        button={null}
      />

      <section className={`${styles.productsListing} max-width`}>
        {/* Client-side computed sidebar - instant filter updates */}
        <ProductsAside
          allProductsMetadata={filterMetadata.products || []}
          allCategories={filterMetadata.categories || []}
          allBrands={filterMetadata.brands || []}
          globalMaxPrice={filterMetadata.globalMaxPrice || 100000}
          basePath="/produkty/"
          currentCategory={null}
          headingLevel="h2"
        />

        {/* Sort dropdown - reads from URL client-side */}
        <SortDropdown
          options={[RELEVANCE_SORT_OPTION, ...PRODUCT_SORT_OPTIONS]}
          basePath="/produkty/"
          defaultValue="orderRank"
        />

        {/* Products listing in Suspense - only this shows skeleton on filter changes */}
        <Suspense fallback={<ProductsListingSkeleton />}>
          <ProductsListing
            searchParams={searchParams}
            basePath="/produkty/"
            defaultSortBy="orderRank"
          />
        </Suspense>
      </section>

      <PageBuilder pageBuilder={pageData.pageBuilder || []} />
    </>
  );
}
