import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import CpoProductGallerySection from '@/src/components/cpo/CpoProductGallerySection';
import CpoProductHero from '@/src/components/cpo/CpoProductHero';
import TechnicalData from '@/src/components/products/TechnicalData';
import ProductViewTracker from '@/src/components/shared/analytics/ProductViewTracker';
import type { SanityRawImage } from '@/src/components/shared/Image';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import type { ContentBlock } from '@/src/components/ui/ContentBlocks';
import type { FormStateData } from '@/src/components/ui/FormStates';
import PillsStickyNav from '@/src/components/ui/PillsStickyNav';
import TwoColumnContent from '@/src/components/ui/TwoColumnContent';
import { getCpoProductBuyability } from '@/src/global/b2c/utils/buyability';
import { limitBuildTimeStaticParams } from '@/src/global/build';
import { sanityFetch } from '@/src/global/sanity/fetch';
import {
  queryAllCpoProductSlugs,
  queryCpoProductBySlug,
  queryCpoProductSeoBySlug,
  queryProductInquiryFormState,
} from '@/src/global/sanity/query';
import type {
  QueryAllCpoProductSlugsResult,
  QueryCpoProductBySlugResult,
  QueryCpoProductSeoBySlugResult,
  QueryProductInquiryFormStateResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import type { PortableTextProps } from '@/src/global/types';

type CpoProductPageProps = {
  params: Promise<{ slug: string }>;
};

function hasTwoColumnPortableText(content: unknown) {
  if (!content || !Array.isArray(content)) return false;

  return content.some((item) => {
    if (!item || typeof item !== 'object' || !('_type' in item)) return false;

    const type = item._type;
    return type === 'ptPageBreak' || type === 'ptTwoColumnLine';
  });
}

function hasTwoColumnContentBlocks(blocks: unknown) {
  if (!blocks || !Array.isArray(blocks)) return false;

  return blocks.some((block) => {
    if (!block || typeof block !== 'object' || !('_type' in block)) {
      return false;
    }
    if (block._type !== 'contentBlockText' || !('content' in block)) {
      return false;
    }

    return hasTwoColumnPortableText(block.content);
  });
}

export async function generateStaticParams() {
  const products = await sanityFetch<QueryAllCpoProductSlugsResult>({
    query: queryAllCpoProductSlugs,
    tags: ['cpoProduct'],
  });

  return limitBuildTimeStaticParams(
    products
      .filter((product) => product.slug)
      .map((product) => ({
        slug: product
          .slug!.replace('/certyfikowany-sprzet-uzywany/', '')
          .replace(/\/$/, ''),
      })),
    // No CPO products may exist yet (e.g. all archived); emit a placeholder so
    // Cache Components build-time validation passes. The page 404s for it.
    { slug: '__placeholder__' },
  );
}

export async function generateMetadata({
  params,
}: CpoProductPageProps): Promise<Metadata> {
  const { slug } = await params;

  const seoData = await sanityFetch<QueryCpoProductSeoBySlugResult>({
    query: queryCpoProductSeoBySlug,
    params: { slug: `/certyfikowany-sprzet-uzywany/${slug}/` },
    tags: ['cpoProduct', `cpoProduct:${slug}`],
  });

  if (!seoData) return getSEOMetadata();

  const forcedSeoTitle = [seoData.brandName, seoData.name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');
  const resolvedTitle =
    forcedSeoTitle || seoData.seo?.title?.trim() || undefined;

  return getSEOMetadata({
    seo: {
      title: resolvedTitle,
      description: seoData.seo?.description,
    },
    slug: seoData.slug,
    openGraph: seoData.openGraph,
  });
}

async function fetchCpoProduct(slug: string) {
  const [product, formStateData] = await Promise.all([
    sanityFetch<QueryCpoProductBySlugResult>({
      query: queryCpoProductBySlug,
      params: { slug: `/certyfikowany-sprzet-uzywany/${slug}/` },
      tags: ['cpoProduct', `cpoProduct:${slug}`],
    }),
    sanityFetch<QueryProductInquiryFormStateResult>({
      query: queryProductInquiryFormState,
      tags: ['settings'],
    }),
  ]);

  return { product, formStateData };
}

export default async function CpoProductPage({ params }: CpoProductPageProps) {
  const { slug } = await params;
  const { product, formStateData } = await fetchCpoProduct(slug);

  if (!product) {
    notFound();
  }

  const heroPreviewImage = (product.resolvedPreviewImage ??
    product.previewImage) as SanityRawImage | null | undefined;
  const productBuyability = getCpoProductBuyability({
    isArchived: product.isArchived,
    isSellableOnline: product.isSellableOnline,
    priceCents: product.priceCents,
    availabilityStatus: product.availabilityStatus,
  });
  const pricePLN =
    typeof product.priceCents === 'number'
      ? Math.round(product.priceCents) / 100
      : null;

  const useOwnGallery = product.useCustomGallery === true;
  const galleryImages = (
    useOwnGallery
      ? product.imageGallery
      : (product.internalProduct?.imageGallery ?? product.imageGallery)
  ) as SanityRawImage[] | null | undefined;

  const breadcrumbsData = [
    {
      name: 'Certyfikowany sprzęt używany',
      path: '/certyfikowany-sprzet-uzywany/',
    },
    {
      name: product.name || '',
      path: product.slug || '',
    },
  ];

  const hasDetailedDescription =
    (product.details?.productDetailContent?.length ?? 0) > 0 ||
    (product.details?.content?.length ?? 0) > 0;
  const hasTwoColumnDetails =
    hasTwoColumnPortableText(product.details?.productDetailContent) ||
    hasTwoColumnContentBlocks(product.details?.content);

  const sections = [
    {
      id: 'szczegoly',
      label: 'Szczegóły',
      visible: hasDetailedDescription,
    },
    {
      id: 'galeria',
      label: 'Galeria',
      visible: !!galleryImages && galleryImages.length > 0,
    },
    {
      id: 'dane-techniczne',
      label: 'Dane techniczne',
      visible:
        !!product.technicalData?.groups &&
        product.technicalData.groups.length > 0,
    },
  ].filter((section) => section.visible);

  return (
    <main id="main" className="page-transition">
      <ProductViewTracker
        productId={product._id}
        productName={product.name ?? ''}
        pricePLN={pricePLN}
        brand={{ name: product.brandName ?? undefined }}
        categories={['cpo']}
      />
      <Breadcrumbs data={breadcrumbsData} firstItemType="productPage" />
      <CpoProductHero
        productId={product._id}
        productKey={product.slug || product._id}
        name={product.name || ''}
        brand={
          product.brandName ? { name: product.brandName, logo: null } : null
        }
        previewImage={heroPreviewImage}
        shortDescription={product.shortDescription as PortableTextProps}
        priceCents={product.priceCents}
        isBuyable={productBuyability.isBuyable}
        isReturnable={product.isReturnable ?? false}
        transparentBackground={product.transparentBackground}
        formStateData={formStateData as FormStateData | null}
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
          product.details?.productDetailContent as PortableTextProps | undefined
        }
        contentBlocks={product.details?.content as ContentBlock[] | null}
        heading={
          product.details?.heading
            ? (product.details.heading as PortableTextProps)
            : 'O produkcie'
        }
        customId="szczegoly"
        className="margin-top-xms"
        narrowContent={!hasTwoColumnDetails}
      />
      <CpoProductGallerySection
        images={galleryImages ?? []}
        customId="galeria"
        heading="Galeria egzemplarza"
      />
      {product.technicalData && (
        <TechnicalData
          data={product.technicalData}
          customId="dane-techniczne"
        />
      )}
    </main>
  );
}
