import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import CollectionPageSchema from '@/src/components/schema/CollectionPageSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import ProductsListing from '@/src/components/ui/ProductsListing';
import ProductsListingSkeleton from '@/src/components/ui/ProductsListing/ProductsListingSkeleton';
import styles from '@/src/components/ui/ProductsListing/styles.module.scss';
import { PRODUCTS_ITEMS_PER_PAGE } from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/client';
import { queryProductsPageData } from '@/src/global/sanity/query';
import type { QueryProductsPageDataResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import { parseBrands } from '@/src/global/utils';

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

  // Parse search params
  const currentPage = Number(searchParams.page) || 1;
  const searchTerm = searchParams.search || '';
  const sortBy = searchParams.sortBy || 'newest';
  const minPrice = Number(searchParams.minPrice) || 0;
  const maxPrice = Number(searchParams.maxPrice) || 999999999;
  const brands = parseBrands(searchParams.brands);

  const productsData = await sanityFetch<QueryProductsPageDataResult>({
    query: queryProductsPageData,
    params: { category: '' },
    tags: ['products', 'productCategorySub', 'product'],
  });

  if (!productsData) {
    logWarn('Products page data not found');
    notFound();
  }

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
      <section className={`${styles.productsGrid} max-width`}>
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
