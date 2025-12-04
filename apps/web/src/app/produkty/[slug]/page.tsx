import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import FeaturedPublications from '@/src/components/pageBuilder/FeaturedPublications';
import ProductsCarousel from '@/src/components/pageBuilder/ProductsCarousel';
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
import { sanityFetch } from '@/src/global/sanity/fetch';
import {
  queryAllProductSlugs,
  queryProductBySlug,
  queryProductSeoBySlug,
} from '@/src/global/sanity/query';
import type {
  QueryAllProductSlugsResult,
  QueryProductBySlugResult,
  QueryProductSeoBySlugResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import { fetchProductPricing } from '@/src/global/supabase/queries';
import type { BrandType, PortableTextProps } from '@/src/global/types';

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

// Fetch product data from Sanity and Supabase
async function fetchProductData(slug: string) {
  const [sanityData, pricingData] = await Promise.all([
    sanityFetch<QueryProductBySlugResult>({
      query: queryProductBySlug,
      params: { slug: `/produkty/${slug}/` },
      tags: ['product'],
    }),
    fetchProductPricing(slug), // Fetch pricing from Supabase
  ]);

  return { sanityData, pricingData };
}

export async function generateStaticParams() {
  const products = await sanityFetch<QueryAllProductSlugsResult>({
    query: queryAllProductSlugs,
    tags: ['product'],
  });

  return products
    .filter((product) => product.slug)
    .map((product) => ({
      slug: product.slug!.replace('/produkty/', '').replace(/\/$/, ''),
    }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  // Use lightweight SEO-only query to reduce deployment metadata size
  const seoData = await sanityFetch<QueryProductSeoBySlugResult>({
    query: queryProductSeoBySlug,
    params: { slug: `/produkty/${slug}/` },
    tags: ['product'],
  });

  if (!seoData) return getSEOMetadata();

  return getSEOMetadata({
    seo: seoData.seo,
    slug: seoData.slug,
    openGraph: seoData.openGraph,
  });
}

export default async function ProductPage(props: ProductPageProps) {
  const { slug } = await props.params;
  const { sanityData: product, pricingData } = await fetchProductData(slug);

  if (!product) {
    console.error(`Product not found: ${slug}`);
    notFound();
  }

  const priceCents = pricingData?.lowestPrice ?? product.basePriceCents ?? null;
  const pricePLN =
    typeof priceCents === 'number' ? Math.round(priceCents) / 100 : null;
  const categorySlugs =
    product.categories?.map((category) => category?.slug).filter(Boolean) ?? [];

  // Determine which stores to display (product stores > brand stores > none)
  const effectiveStores =
    product.availableInStores && product.availableInStores.length > 0
      ? product.availableInStores
      : product.brand?.stores && product.brand.stores.length > 0
        ? product.brand.stores
        : null;

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
      visible: !!product.details?.content,
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
      <Breadcrumbs data={breadcrumbsData} />
      <ProductHero
        name={product.name || ''}
        subtitle={product.subtitle || ''}
        brand={product.brand as unknown as BrandType | undefined}
        pricingData={pricingData}
        previewImage={product.previewImage as SanityRawImage}
        shortDescription={product.shortDescription}
        awards={product.awards as AwardType[]}
        productId={product._id}
        categorySlug={product.categories?.[0]?.slug ?? ''}
      />
      {sections.length > 1 && (
        <PillsStickyNav
          sections={
            sections as { id: string; label: string; visible: boolean }[]
          }
        />
      )}
      <TwoColumnContent
        contentBlocks={product.details?.content as ContentBlock[]}
        heading={
          product.details?.heading
            ? (product.details.heading as PortableTextProps)
            : 'O produkcie'
        }
        customId="szczegoly"
        gallery={product.imageGallery as SanityRawImage[]}
        className="margin-top-xms"
      />
      {product.technicalData && (
        <TechnicalData
          data={product.technicalData}
          customId="dane-techniczne"
        />
      )}
      {effectiveStores && effectiveStores.length > 0 && (
        <StoreLocations
          customId="gdzie-kupic"
          stores={effectiveStores.filter((s) => s !== null)}
        />
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
          publications={product.reviews}
          button={{
            text: 'Zobacz wszystkie recenzje',
            href: '/recenzje',
            variant: 'primary' as const,
            _key: null,
            _type: 'button',
            openInNewTab: false,
          }}
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
      {product.pageBuilder && <PageBuilder pageBuilder={product.pageBuilder} />}
    </main>
  );
}
