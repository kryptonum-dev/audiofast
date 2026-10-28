import type { Metadata } from 'next';
import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import FeaturedPublications from '@/src/components/pageBuilder/FeaturedPublications';
import ProductsCarousel from '@/src/components/pageBuilder/ProductsCarousel';
import DownloadSection from '@/src/components/products/DownloadSection';
import ProductHero, {
  type AwardType,
} from '@/src/components/products/ProductHero';
import TechnicalData from '@/src/components/products/TechnicalData';
import ProductViewTracker from '@/src/components/shared/analytics/ProductViewTracker';
import type { SanityRawImage } from '@/src/components/shared/Image';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import type { ContentBlock } from '@/src/components/ui/ContentBlocks';
import PillsStickyNav from '@/src/components/ui/PillsStickyNav';
import StoreLocations from '@/src/components/ui/StoreLocations';
import TwoColumnContent from '@/src/components/ui/TwoColumnContent';
import {
  getStandardProductAvailability,
  getStandardProductBuyability,
} from '@/src/global/b2c/utils/buyability';
import { limitBuildTimeStaticParams } from '@/src/global/build';
import {
  needsBrandStores,
  pickEffectiveStores,
} from '@/src/global/products/brand-stores';
import { getDataAttribute } from '@/src/global/sanity/data-attribute';
import {
  type CachedProps,
  renderDraftAware,
} from '@/src/global/sanity/draft-aware';
import {
  type DynamicFetchOptions,
  PUBLISHED,
  sanityFetchCached,
  sanityFetchStaticParams,
} from '@/src/global/sanity/live';
import {
  queryAllProductSlugs,
  queryArchivedProductCta,
  queryBrandStoresById,
  queryProductBySlug,
  queryProductInquiryFormState,
} from '@/src/global/sanity/query';
import type {
  QueryAllProductSlugsResult,
  QueryArchivedProductCtaResult,
  QueryBrandStoresByIdResult,
  QueryProductBySlugResult,
  QueryProductInquiryFormStateResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import { fetchProductPricing } from '@/src/global/supabase/queries';
import type { BrandType, PortableTextProps } from '@/src/global/types';

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

// Shared cached data function: metadata (PUBLISHED) and the published page
// render read the same entry, so the old SEO-only query is gone.
function getProductData(slug: string, options: DynamicFetchOptions) {
  return sanityFetchCached<QueryProductBySlugResult>({
    requestTag: 'product.page',
    query: queryProductBySlug,
    params: { slug: `/produkty/${slug}/` },
    ...options,
  });
}

// Fetch product data from Sanity and Supabase
async function fetchProductData(slug: string, options: DynamicFetchOptions) {
  const [sanityData, pricingData, formStateData] = await Promise.all([
    getProductData(slug, options),
    fetchProductPricing(slug), // Fetch pricing from Supabase (own cache)
    sanityFetchCached<QueryProductInquiryFormStateResult>({
      requestTag: 'product.inquiry-form',
      query: queryProductInquiryFormState,
      ...options,
    }),
  ]);

  return { sanityData, pricingData, formStateData };
}

// The brand's dealer list lives in its own cache entry, so its sync tags (the
// brand and its stores) are not mixed into the product data above: a brand or
// store publish refreshes it on every product page that inherits it.
async function fetchBrandStores(
  brandId: string | null | undefined,
  options: DynamicFetchOptions,
) {
  if (!brandId) return null;

  return sanityFetchCached<QueryBrandStoresByIdResult>({
    requestTag: 'product.brand-stores',
    query: queryBrandStoresById,
    params: { brandId },
    ...options,
  });
}

export async function generateStaticParams() {
  const products = await sanityFetchStaticParams<QueryAllProductSlugsResult>({
    requestTag: 'product.static-params',
    query: queryAllProductSlugs,
  });

  return limitBuildTimeStaticParams(
    products
      .filter((product) => product.slug)
      .map((product) => ({
        slug: product.slug!.replace('/produkty/', '').replace(/\/$/, ''),
      })),
    { slug: '__placeholder__' },
  );
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const seoData = await getProductData(slug, PUBLISHED);

  if (!seoData) return getSEOMetadata();

  const autoTitle = [seoData.brandName?.trim(), seoData.name?.trim()]
    .filter(Boolean)
    .join(' ');
  const resolvedTitle = seoData.seo?.title?.trim() || autoTitle || undefined;

  return getSEOMetadata({
    seo: {
      title: resolvedTitle,
      description: seoData.seo?.description,
    },
    slug: seoData.slug,
    openGraph: seoData.openGraph,
    noNotIndex: seoData.doNotIndex,
  });
}

export default async function ProductPage(props: ProductPageProps) {
  const { slug } = await props.params;
  return renderDraftAware(CachedProduct, { slug });
}

async function CachedProduct({
  slug,
  perspective,
  stega,
  isDraft = false,
}: CachedProps & { slug: string }) {
  'use cache';
  cacheLife('sanity');
  const options = { perspective, stega };
  const {
    sanityData: product,
    pricingData,
    formStateData,
  } = await fetchProductData(slug, options);

  if (!product) {
    console.error(`Product not found: ${slug}`);
    notFound();
  }

  const priceCents = pricingData?.lowestPrice ?? product.basePriceCents ?? null;
  const pricePLN =
    typeof priceCents === 'number' ? Math.round(priceCents) / 100 : null;
  const productBuyability = getStandardProductBuyability({
    isSellableOnline: product.isSellableOnline,
    pricingData,
  });
  // Archived + no price => show the "product unavailable" notice
  const productAvailability = getStandardProductAvailability({
    isArchived: product.isArchived,
    pricingData,
  });
  // Contact CTA replaces "Zapytaj o produkt" on unavailable products;
  // fetched only when needed.
  const archivedProductCta = productAvailability.isUnavailable
    ? await sanityFetchCached<QueryArchivedProductCtaResult>({
        requestTag: 'product.archived-cta',
        query: queryArchivedProductCta,
        ...options,
      })
    : null;
  const categorySlugs =
    product.categories?.map((category) => category?.slug).filter(Boolean) ?? [];

  // Determine which stores to display (product stores > brand stores > none).
  // The brand's list is only fetched when the product has no own stores.
  const usesBrandStores = needsBrandStores(product.availableInStores);
  const brandStores = usesBrandStores
    ? await fetchBrandStores(product.brand?._id, options)
    : null;

  // Draft only (null otherwise): nested arrays the editor can drag in
  // Presentation. The store list belongs to whichever document supplied it.
  const productAttribute = getDataAttribute({
    id: product._id,
    type: 'product',
    isDraft,
  });
  const storesAttribute = usesBrandStores
    ? getDataAttribute({
        id: product.brand?._id,
        type: 'brand',
        isDraft,
      })?.scope('stores')
    : productAttribute?.scope('availableInStores');
  const effectiveStores = pickEffectiveStores(
    product.availableInStores,
    brandStores,
  );

  // Breadcrumbs data
  const breadcrumbsData = [
    {
      name: 'Produkty',
      path: '/produkty/',
    },
    {
      name: product.name || '',
      path: product.slug || '',
    },
  ];

  // Determine which sections are visible for sticky navigation
  const sections = [
    {
      id: 'szczegoly',
      label: 'Szczegóły',
      visible:
        !!product.details?.productDetailContent || !!product.details?.content,
    },
    {
      id: 'dane-techniczne',
      label: 'Dane techniczne',
      visible:
        !!product.technicalData &&
        product.technicalData.groups &&
        product.technicalData.groups.length > 0,
    },
    {
      id: 'do-pobrania',
      label: 'Do pobrania',
      visible:
        !!product.downloadablePdfs && product.downloadablePdfs.length > 0,
    },
    {
      id: 'gdzie-kupic',
      label: 'Gdzie kupić',
      visible: !!effectiveStores && effectiveStores.length > 0,
    },
    {
      id: 'recenzje',
      label: 'Recenzje',
      visible: !!product.reviews && product.reviews.length > 0,
    },
  ].filter((section) => section.visible);

  return (
    <main id="main" className="page-transition">
      {/* No Meta/GA events from editors previewing in Presentation. */}
      {!isDraft && (
        <ProductViewTracker
          productId={product._id}
          productName={product.name ?? ''}
          pricePLN={pricePLN}
          brand={{
            id: product.brand?._id ?? undefined,
            name: product.brand?.name ?? undefined,
          }}
          categories={categorySlugs.filter(Boolean) as string[]}
        />
      )}
      <Breadcrumbs data={breadcrumbsData} firstItemType="productPage" />
      <ProductHero
        name={product.name || ''}
        subtitle={product.subtitle || ''}
        headingOverride={product.headingOverride}
        brand={product.brand as unknown as BrandType | undefined}
        pricingData={pricingData}
        isBuyable={productBuyability.isBuyable}
        isUnavailable={productAvailability.isUnavailable}
        archivedCta={archivedProductCta}
        isReturnable={product.isReturnable ?? false}
        previewImage={product.previewImage as SanityRawImage}
        shortDescription={product.shortDescription}
        awards={product.awards as AwardType[]}
        productId={product._id}
        categories={product.categories}
        formStateData={formStateData}
        isDraft={isDraft}
      />
      {sections.length > 1 && (
        <PillsStickyNav
          sections={
            sections as { id: string; label: string; visible: boolean }[]
          }
        />
      )}
      <TwoColumnContent
        unifiedContent={
          product.details?.productDetailContent as PortableTextProps
        }
        contentBlocks={product.details?.content as ContentBlock[]}
        heading={
          product.details?.heading
            ? (product.details.heading as PortableTextProps)
            : 'O produkcie'
        }
        customId="szczegoly"
        gallery={product.imageGallery as SanityRawImage[]}
        unifiedContentDataAttribute={productAttribute?.scope([
          'details',
          'productDetailContent',
        ])}
        className="margin-top-xms"
      />
      {product.technicalData && (
        <TechnicalData
          data={product.technicalData}
          customId="dane-techniczne"
        />
      )}
      {product.downloadablePdfs && product.downloadablePdfs.length > 0 && (
        <DownloadSection
          data={product.downloadablePdfs}
          productSlug={product.slug || ''}
          customId="do-pobrania"
          dataAttribute={productAttribute?.scope('downloadablePdfs')}
        />
      )}
      {effectiveStores && effectiveStores.length > 0 && (
        <Suspense fallback={null}>
          <StoreLocations
            customId="gdzie-kupic"
            stores={effectiveStores}
            isDraft={isDraft}
            storesAttribute={storesAttribute}
          />
        </Suspense>
      )}
      {product.reviews && (
        <FeaturedPublications
          heading={[
            {
              _type: 'block',
              children: [
                {
                  _type: 'span',
                  text: 'Recenzje produktu',
                  _key: 'recenzje-produktu',
                },
              ],
              style: 'normal',
              _key: '',
              markDefs: null,
              listItem: undefined,
              level: undefined,
            },
          ]}
          selectionMode="latest"
          publications={product.reviews}
          index={1}
          _key=""
          _type="featuredPublications"
          customId="recenzje"
          publicationLayout="horizontal"
        />
      )}
      {product.relatedProducts && product.relatedProducts.length > 0 && (
        <ProductsCarousel
          heading={[
            {
              _type: 'block',
              children: [
                {
                  _type: 'span',
                  text: 'Powiązane produkty',
                  _key: 'powiazane-produkty',
                },
              ],
              style: 'normal',
              _key: '',
              markDefs: null,
              listItem: undefined,
              level: undefined,
            },
          ]}
          products={product.relatedProducts}
          index={2}
          _key=""
          _type="productsCarousel"
          customId="powiazane-produkty"
        />
      )}
      {product.pageBuilder && (
        <PageBuilder
          pageBuilder={product.pageBuilder}
          indexOffset={1}
          fetchOptions={options}
          documentId={product._id}
          documentType="product"
          isDraft={isDraft}
        />
      )}
    </main>
  );
}
