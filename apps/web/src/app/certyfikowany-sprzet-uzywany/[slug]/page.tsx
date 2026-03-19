import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import CpoProductGallerySection from '@/src/components/cpo/CpoProductGallerySection';
import CpoProductHero from '@/src/components/cpo/CpoProductHero';
import TechnicalData from '@/src/components/products/TechnicalData';
import type { SanityRawImage } from '@/src/components/shared/Image';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import type { FormStateData } from '@/src/components/ui/FormStates';
import PillsStickyNav from '@/src/components/ui/PillsStickyNav';
import TwoColumnContent from '@/src/components/ui/TwoColumnContent';
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

export async function generateStaticParams() {
  const products = await sanityFetch<QueryAllCpoProductSlugsResult>({
    query: queryAllCpoProductSlugs,
    tags: ['cpoProduct'],
  });

  return products
    .filter((product) => product.slug)
    .map((product) => ({
      slug: product
        .slug!.replace('/certyfikowany-sprzet-uzywany/', '')
        .replace(/\/$/, ''),
    }));
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

  const forcedSeoTitle = [seoData.brand?.name, seoData.name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');

  return getSEOMetadata({
    seo: {
      title: forcedSeoTitle || undefined,
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

  const sections = [
    {
      id: 'szczegoly',
      label: 'Szczegóły',
      visible:
        !!product.details?.productDetailContent &&
        product.details.productDetailContent.length > 0,
    },
    {
      id: 'galeria',
      label: 'Galeria',
      visible: !!product.imageGallery && product.imageGallery.length > 0,
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
      <Breadcrumbs data={breadcrumbsData} />
      <CpoProductHero
        productId={product._id}
        name={product.name || ''}
        brand={product.brand}
        previewImage={product.previewImage as SanityRawImage}
        shortDescription={product.shortDescription as PortableTextProps}
        priceCents={product.priceCents}
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
        heading={
          product.details?.heading
            ? (product.details.heading as PortableTextProps)
            : 'O produkcie'
        }
        customId="szczegoly"
        className="margin-top-xms"
        narrowContent
      />
      <CpoProductGallerySection
        images={product.imageGallery as SanityRawImage[]}
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
