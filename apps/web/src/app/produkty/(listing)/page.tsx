import { notFound } from "next/navigation";
import { Suspense } from "react";

import { fetchEmbeddings } from "@/src/app/actions/embeddings";
import HeroStatic from "@/src/components/pageBuilder/HeroStatic";
import ProductsAside from "@/src/components/products/ProductsAside";
import ProductsListing from "@/src/components/products/ProductsListing";
import ProductsListingSkeleton from "@/src/components/products/ProductsListing/ProductsListingSkeleton";
import styles from "@/src/components/products/ProductsListing/styles.module.scss";
import SortDropdown from "@/src/components/products/SortDropdown";
import CollectionPageSchema from "@/src/components/schema/CollectionPageSchema";
import CategoryViewTracker from "@/src/components/shared/analytics/CategoryViewTracker";
import { PageBuilder } from "@/src/components/shared/PageBuilder";
import Breadcrumbs from "@/src/components/ui/Breadcrumbs";
import {
  PRODUCT_SORT_OPTIONS,
  PRODUCTS_ITEMS_PER_PAGE,
  RELEVANCE_SORT_OPTION,
} from "@/src/global/constants";
import { logWarn } from "@/src/global/logger";
import { sanityFetch } from "@/src/global/sanity/fetch";
import { queryProductsPageData } from "@/src/global/sanity/query";
import type { QueryProductsPageDataResult } from "@/src/global/sanity/sanity.types";
import { getSEOMetadata } from "@/src/global/seo";
import { parseBrands, parsePrice } from "@/src/global/utils";

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
    params: {
      category: "",
      search: "",
      brands: [],
      minPrice: 0,
      maxPrice: 999999999,
      customFilters: [],
    },
    tags: ["products"],
  });

  if (!productsData) {
    logWarn("Products page data not found");
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

  // Parse search params first (before fetching data)
  const currentPage = Number(searchParams.page) || 1;
  const searchTerm = searchParams.search || "";
  const hasSearchQuery = Boolean(searchTerm);

  // Fetch embeddings if search query exists (for semantic search)
  // Always return an array (empty if no search) to satisfy GROQ parameter requirements
  const embeddingResults = hasSearchQuery
    ? (await fetchEmbeddings(searchTerm, "products")) || []
    : [];

  // Determine sortBy: if search exists and no explicit sortBy, default to 'relevance'
  // Otherwise use provided sortBy or default to 'orderRank'
  const sortBy = hasSearchQuery
    ? searchParams.sortBy || "relevance"
    : searchParams.sortBy || "orderRank";

  // Parse brands early (needed for query)
  const brands = parseBrands(searchParams.brands);

  // Parse prices with initial defaults (will be validated after fetch)
  let minPrice = parsePrice(searchParams.minPrice, 0);
  let maxPrice = parsePrice(searchParams.maxPrice, 999999999, 999999999);

  // Fetch products data with filter parameters
  // This returns filtered categories, brands, and price range based on active filters
  const productsData = await sanityFetch<QueryProductsPageDataResult>({
    query: queryProductsPageData,
    params: {
      category: "",
      search: searchTerm,
      brands,
      minPrice,
      maxPrice,
      customFilters: [],
      embeddingResults, // Pass embeddings for filtering
    },
    tags: ["products"],
  });

  if (!productsData) {
    logWarn("Products page data not found");
    notFound();
  }

  // Get the actual maximum price from filtered products
  // If no products match filters, maxPrice will be null, so fallback to a default
  const actualMaxPrice = productsData.maxPrice ?? 100000;
  const actualMinPrice = productsData.minPrice ?? 0;

  // Only adjust prices if user applied filters, otherwise keep defaults
  // This ensures products without prices are shown when no filter is active
  if (Boolean(searchParams.minPrice) && minPrice > actualMaxPrice) {
    minPrice = actualMinPrice;
  }
  if (Boolean(searchParams.maxPrice) && maxPrice > actualMaxPrice) {
    maxPrice = actualMaxPrice;
  }
  if (Boolean(searchParams.maxPrice) && maxPrice < 1) {
    maxPrice = actualMaxPrice;
  }

  const breadcrumbsData = [
    {
      name: productsData.name || "Produkty",
      path: "/produkty/",
    },
  ];

  return (
    <>
      <CategoryViewTracker
        categoryId={productsData.slug ?? "/produkty/"}
        categoryName={productsData.name || "Produkty"}
        totalItems={productsData.totalCount}
      />
      <CollectionPageSchema
        name={productsData.name || "Produkty"}
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
        _key={""}
        _type={"heroStatic"}
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
          options={
            hasSearchQuery
              ? [RELEVANCE_SORT_OPTION, ...PRODUCT_SORT_OPTIONS]
              : PRODUCT_SORT_OPTIONS
          }
          basePath="/produkty/"
          defaultValue={hasSearchQuery ? "relevance" : "orderRank"}
          hasSearchQuery={hasSearchQuery}
        />
        <Suspense
          key={`page-${currentPage}-search-${searchTerm}-sort-${sortBy}-brands-${brands.join(",")}-price-${minPrice}-${maxPrice}`}
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
            embeddingResults={embeddingResults}
          />
        </Suspense>
      </section>
      <PageBuilder pageBuilder={productsData.pageBuilder || []} />
    </>
  );
}
