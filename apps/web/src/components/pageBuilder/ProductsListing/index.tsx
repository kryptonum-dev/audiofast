import { Suspense } from "react";

import type { PageBuilderBlock } from "@/src/components/shared/PageBuilder";
import { PRODUCT_SORT_OPTIONS } from "@/src/global/constants";

import ProductsAside from "../../products/ProductsAside";
import ProductsListingComponent from "../../products/ProductsListing";
import ProductsListingSkeleton from "../../products/ProductsListing/ProductsListingSkeleton";
import styles from "../../products/ProductsListing/styles.module.scss";
import SortDropdown from "../../products/SortDropdown";

type ProductsListingBlockType = Extract<
  PageBuilderBlock,
  { _type: "productsListing" }
>;

type ProductsListingProps = ProductsListingBlockType & {
  index: number;
  searchParams?: {
    page?: string;
    category?: string;
    sortBy?: string | string[];
  };
  basePath?: string; // Current page path for URL construction
};

export default async function ProductsListing(props: ProductsListingProps) {
  const {
    heading,
    cpoOnly,
    categories,
    totalCount,
    searchParams,
    basePath = "/",
  } = props;

  const searchParamsResult = searchParams || {};
  const currentPage = Number(searchParamsResult.page) || 1;
  const categoryParam = searchParamsResult.category || "";
  const sortBy = searchParamsResult.sortBy || "newest";

  // Convert category param to Sanity format if provided
  const categorySlug = categoryParam ? `/kategoria/${categoryParam}/` : "";

  // Items per page - hardcoded as per requirements
  const itemsPerPage = 12;

  return (
    <section className={`${styles.productsListing} max-width`}>
      <ProductsAside
        categories={categories || []}
        brands={[]}
        totalCount={totalCount || 0}
        maxPrice={0}
        basePath={basePath}
        currentCategory={categoryParam || null}
        initialSearch=""
        initialBrands={[]}
        initialMinPrice={0}
        initialMaxPrice={999999999}
        heading={heading}
        visibleFilters={{
          search: false,
          categories: true,
          brands: false,
          priceRange: false,
        }}
        useCategorySearchParam={true}
        headingLevel="h3"
      />
      <SortDropdown
        options={PRODUCT_SORT_OPTIONS}
        basePath={basePath}
        defaultValue="newest"
        hasSearchQuery={false}
      />
      <Suspense
        key={`page-${currentPage}-category-${categoryParam}-sort-${sortBy}`}
        fallback={<ProductsListingSkeleton />}
      >
        <ProductsListingComponent
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          searchTerm=""
          category={categorySlug}
          sortBy={sortBy as string}
          brands={[]}
          minPrice={0}
          maxPrice={999999999}
          customFilters={[]}
          isCPO={cpoOnly}
          basePath={basePath}
        />
      </Suspense>
    </section>
  );
}
