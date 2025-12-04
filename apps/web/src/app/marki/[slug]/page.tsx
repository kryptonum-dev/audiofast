import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { fetchEmbeddings } from "@/src/app/actions/embeddings";
import FeaturedPublications from "@/src/components/pageBuilder/FeaturedPublications";
import HeroStatic from "@/src/components/pageBuilder/HeroStatic";
import ProductsAside from "@/src/components/products/ProductsAside";
import ProductsListing from "@/src/components/products/ProductsListing";
import ProductsListingSkeleton from "@/src/components/products/ProductsListing/ProductsListingSkeleton";
import styles from "@/src/components/products/ProductsListing/styles.module.scss";
import SortDropdown from "@/src/components/products/SortDropdown";
import type { SanityRawImage } from "@/src/components/shared/Image";
import Image from "@/src/components/shared/Image";
import Breadcrumbs from "@/src/components/ui/Breadcrumbs";
import type { ContentBlock } from "@/src/components/ui/ContentBlocks";
import PillsStickyNav from "@/src/components/ui/PillsStickyNav";
import StoreLocations from "@/src/components/ui/StoreLocations";
import TwoColumnContent from "@/src/components/ui/TwoColumnContent";
import {
  PRODUCT_SORT_OPTIONS,
  PRODUCTS_ITEMS_PER_PAGE,
  RELEVANCE_SORT_OPTION,
} from "@/src/global/constants";
import { logWarn } from "@/src/global/logger";
import { sanityFetch } from "@/src/global/sanity/fetch";
import {
  queryAllBrandSlugs,
  queryBrandBySlug,
  queryBrandSeoBySlug,
} from "@/src/global/sanity/query";
import type {
  QueryAllBrandSlugsResult,
  QueryBrandBySlugResult,
  QueryBrandSeoBySlugResult,
} from "@/src/global/sanity/sanity.types";
import { getSEOMetadata } from "@/src/global/seo";
import type { PublicationType } from "@/src/global/types";
import { parsePrice } from "@/src/global/utils";

type BrandPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    category?: string; // Category filter via search param (e.g., ?category=glosniki-podlogowe)
    minPrice?: string;
    maxPrice?: string;
  }>;
};

// Fetch brand data with filter metadata
// The query now includes products filter metadata (categories, brands, price ranges)
// Pass filter params to get filtered counts
function fetchBrandData(
  slug: string,
  filters?: {
    category?: string;
    search?: string;
    brands?: string[];
    minPrice?: number;
    maxPrice?: number;
    embeddingResults?: Array<{
      score: number;
      value: { documentId: string; type: string };
    }>;
  },
) {
  return sanityFetch<QueryBrandBySlugResult>({
    query: queryBrandBySlug,
    params: {
      slug: `/marki/${slug}/`,
      category: filters?.category || "", // Category filter via search param
      search: filters?.search || "",
      brands: filters?.brands || [],
      minPrice: filters?.minPrice || 0,
      maxPrice: filters?.maxPrice || 999999999,
      customFilters: [], // Brand pages don't have custom filters
      embeddingResults: filters?.embeddingResults || [], // Embeddings for semantic search
    },
    tags: ["brand"],
  });
}

export async function generateStaticParams() {
  const brands = await sanityFetch<QueryAllBrandSlugsResult>({
    query: queryAllBrandSlugs,
    tags: ["brand"],
  });

  return brands
    .filter((brand) => brand.slug)
    .map((brand) => ({
      slug: brand.slug!.replace("/marki/", "").replace(/\/$/, ""),
    }));
}

export async function generateMetadata({
  params,
}: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  // Use lightweight SEO-only query to reduce deployment metadata size
  const seoData = await sanityFetch<QueryBrandSeoBySlugResult>({
    query: queryBrandSeoBySlug,
    params: { slug: `/marki/${slug}/` },
    tags: ["brand"],
  });

  if (!seoData) return getSEOMetadata();

  return getSEOMetadata({
    seo: seoData.seo,
    slug: seoData.slug,
    openGraph: seoData.openGraph,
  });
}

export default async function BrandPage(props: BrandPageProps) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;

  // Parse search params
  const currentPage = Number(searchParams.page) || 1;
  const searchTerm = searchParams.search || "";
  const categorySlug = searchParams.category || ""; // Category filter via search param (e.g., "glosniki-podstawkowe")

  // Normalize category slug to match Sanity format: /kategoria/slug/
  // Query expects: /kategoria/glosniki-podstawkowe/
  // URL has: glosniki-podstawkowe
  const normalizedCategory = categorySlug ? `/kategoria/${categorySlug}/` : "";

  const hasSearchQuery = Boolean(searchTerm);

  // Fetch embeddings if search query exists (for semantic search)
  // Always return an array (empty if no search) to satisfy GROQ parameter requirements
  const embeddingResults = hasSearchQuery
    ? (await fetchEmbeddings(searchTerm, "products")) || []
    : [];

  // Determine sortBy: if search exists and no explicit sortBy, default to 'relevance'
  // Otherwise use provided sortBy or default to 'newest'
  const sortBy = hasSearchQuery
    ? searchParams.sortBy || "relevance"
    : searchParams.sortBy || "newest";

  let minPrice = parsePrice(searchParams.minPrice, 0);
  let maxPrice = parsePrice(searchParams.maxPrice, 999999999, 999999999);

  // Fetch brand data with filter metadata in a single API call
  // NOTE: We don't pass category filter here to get ALL categories in sidebar
  // The category filter is applied only in ProductsListing component
  const brand = await fetchBrandData(slug, {
    category: "", // Don't filter categories in sidebar - show all categories
    search: searchTerm,
    brands: [slug], // Filter products by current brand
    minPrice,
    maxPrice,
    embeddingResults, // Pass embeddings for semantic search
  });

  if (!brand) {
    logWarn(`Brand not found for slug: ${slug}, returning 404`);
    notFound();
  }

  // Get the actual maximum price from filtered products
  const actualMaxPrice = brand.maxPrice ?? 100000;
  const actualMinPrice = brand.minPrice ?? 0;

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
      name: "Marki",
      path: "/marki",
    },
    {
      name: brand.name || "",
      path: brand.slug || "",
    },
  ];

  // Determine which sections are visible for sticky navigation
  const sections = [
    { id: "produkty", label: "Produkty", visible: true },
    {
      id: "o-marce",
      label: "O marce",
      visible:
        !!brand.brandContentBlocks && brand.brandContentBlocks.length > 0,
    },
    {
      id: "recenzje",
      label: "Recenzje",
      visible: !!brand.featuredReviews,
    },
    {
      id: "gdzie-kupic",
      label: "Gdzie kupić",
      visible: !!brand.stores,
    },
  ].filter((section) => section.visible);

  return (
    <main id="main" className="page-transition">
      <Breadcrumbs data={breadcrumbsData} firstItemType="heroStatic" />
      <HeroStatic
        heading={[
          {
            _type: "block",
            children: [{ _type: "span", text: brand.name || "", _key: "" }],
            style: "normal",
            _key: "",
            markDefs: null,
            listItem: undefined,
            level: undefined,
          },
        ]}
        description={brand.description}
        image={brand.heroImage}
        showBlocks={false}
        blocksHeading={null}
        blocks={[]}
        index={0}
        _key=""
        _type="heroStatic"
        button={null}
      />
      {sections.length > 1 && <PillsStickyNav sections={sections} />}
      <section id="produkty" className={`${styles.productsListing} max-width`}>
        <ProductsAside
          categories={brand.categories || []}
          brands={brand.brands || []}
          totalCount={brand.totalCount || 0}
          maxPrice={actualMaxPrice}
          basePath={`/marki/${slug}/`}
          currentCategory={categorySlug || null}
          initialSearch={searchTerm}
          initialBrands={[]}
          initialMinPrice={minPrice}
          initialMaxPrice={maxPrice}
          useCategorySearchParam={true}
          visibleFilters={{
            search: true,
            categories: true,
            brands: false,
            priceRange: false,
          }}
        />
        <SortDropdown
          options={
            hasSearchQuery
              ? [RELEVANCE_SORT_OPTION, ...PRODUCT_SORT_OPTIONS]
              : PRODUCT_SORT_OPTIONS
          }
          basePath={`/marki/${slug}/`}
          defaultValue={hasSearchQuery ? "relevance" : "newest"}
          hasSearchQuery={hasSearchQuery}
        />
        <Suspense
          key={`brand-${slug}-page-${currentPage}-search-${searchTerm}-category-${categorySlug}-sort-${sortBy}-price-${minPrice}-${maxPrice}`}
          fallback={<ProductsListingSkeleton />}
        >
          <ProductsListing
            currentPage={currentPage}
            itemsPerPage={PRODUCTS_ITEMS_PER_PAGE}
            searchTerm={searchTerm}
            category={normalizedCategory}
            sortBy={sortBy}
            brandSlug={slug}
            minPrice={minPrice}
            maxPrice={maxPrice}
            basePath={`/marki/${slug}/`}
            embeddingResults={embeddingResults}
          />
        </Suspense>
      </section>
      {brand.bannerImage && (
        <section className="max-width-block br-md margin-bottom-lg">
          <Image
            image={brand.bannerImage}
            alt={brand.name || ""}
            className="br-md full-width"
            sizes="(max-width: 37.4375rem) 98vw, (max-width: 85.375rem) 96vw, 1302px"
            loading="lazy"
          />
        </section>
      )}
      <TwoColumnContent
        contentBlocks={brand.brandContentBlocks as ContentBlock[]}
        customId="o-marce"
        distributionYear={brand.distributionYear}
        gallery={brand.imageGallery as SanityRawImage[]}
      />

      {brand.featuredReviews && (
        <FeaturedPublications
          heading={[
            {
              _type: "block",
              children: [
                {
                  _type: "span",
                  text: "Recenzje Marki",
                  _key: "recenzje-marki",
                },
              ],
              style: "normal",
              _key: "",
              markDefs: null,
              listItem: undefined,
              level: undefined,
            },
          ]}
          isButtonVisible={false}
          button={{
            text: "Zobacz wszystkie recenzje",
            href: "/blog/",
            variant: "primary" as const,
            _key: null,
            _type: "button",
            openInNewTab: false,
          }}
          publications={brand.featuredReviews as unknown as PublicationType[]}
          index={1}
          _key=""
          _type="featuredPublications"
          customId="recenzje"
        />
      )}
      {brand.stores &&
        Array.isArray(brand.stores) &&
        brand.stores.length > 0 && (
          <StoreLocations
            customId="gdzie-kupic"
            stores={brand.stores.filter((s) => s !== null)}
          />
        )}
    </main>
  );
}
