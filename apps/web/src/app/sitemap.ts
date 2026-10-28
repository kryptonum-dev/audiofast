import type { MetadataRoute } from 'next';

import { BASE_URL } from '@/global/constants';
import { sanityFetchPublished } from '@/global/sanity/live';
import {
  queryAllBlogCategorySlugsForSitemap,
  queryAllBlogPostSlugsForSitemap,
  queryAllBrandSlugsForSitemap,
  queryAllCpoProductSlugsForSitemap,
  queryAllPageSlugsForSitemap,
  queryAllProductCategorySlugsForSitemap,
  queryAllProductSlugsForSitemap,
  queryAllReviewSlugsForSitemap,
} from '@/global/sanity/query';

type SitemapEntry = {
  slug: string;
  _updatedAt: string;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [
    pages,
    blogPosts,
    brands,
    cpoProducts,
    products,
    reviews,
    blogCategories,
    productCategories,
  ] = await Promise.all([
    sanityFetchPublished<SitemapEntry[]>({
      requestTag: 'sitemap.pages',
      query: queryAllPageSlugsForSitemap,
    }),
    sanityFetchPublished<SitemapEntry[]>({
      requestTag: 'sitemap.blog-articles',
      query: queryAllBlogPostSlugsForSitemap,
    }),
    sanityFetchPublished<SitemapEntry[]>({
      requestTag: 'sitemap.brands',
      query: queryAllBrandSlugsForSitemap,
    }),
    sanityFetchPublished<SitemapEntry[]>({
      requestTag: 'sitemap.cpo-products',
      query: queryAllCpoProductSlugsForSitemap,
    }),
    sanityFetchPublished<SitemapEntry[]>({
      requestTag: 'sitemap.products',
      query: queryAllProductSlugsForSitemap,
    }),
    sanityFetchPublished<SitemapEntry[]>({
      requestTag: 'sitemap.reviews',
      query: queryAllReviewSlugsForSitemap,
    }),
    sanityFetchPublished<SitemapEntry[]>({
      requestTag: 'sitemap.blog-categories',
      query: queryAllBlogCategorySlugsForSitemap,
    }),
    sanityFetchPublished<SitemapEntry[]>({
      requestTag: 'sitemap.product-categories',
      query: queryAllProductCategorySlugsForSitemap,
    }),
  ]);

  // Static routes that are always present
  const staticRoutes = [
    '/',
    '/blog/',
    '/certyfikowany-sprzet-uzywany/',
    '/marki/',
    '/polityka-prywatnosci/',
    '/produkty/',
    '/regulamin/',
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date().toISOString(),
  }));

  const dynamicRoutes: MetadataRoute.Sitemap = [
    ...pages.map((entry) => ({
      url: `${BASE_URL}/${entry.slug.replace(/^\//, '')}`,
      lastModified: entry._updatedAt,
    })),
    ...blogPosts.map((entry) => ({
      url: `${BASE_URL}${entry.slug}`,
      lastModified: entry._updatedAt,
    })),
    ...blogCategories.map((entry) => ({
      url: `${BASE_URL}${entry.slug}`,
      lastModified: entry._updatedAt,
    })),
    ...brands.map((entry) => ({
      url: `${BASE_URL}${entry.slug}`,
      lastModified: entry._updatedAt,
    })),
    ...cpoProducts.map((entry) => ({
      url: `${BASE_URL}${entry.slug}`,
      lastModified: entry._updatedAt,
    })),
    ...products.map((entry) => ({
      url: `${BASE_URL}${entry.slug}`,
      lastModified: entry._updatedAt,
    })),
    ...productCategories.map((entry) => ({
      url: `${BASE_URL}/produkty${entry.slug}`,
      lastModified: entry._updatedAt,
    })),
    ...reviews.map((entry) => ({
      url: `${BASE_URL}${entry.slug}`,
      lastModified: entry._updatedAt,
    })),
  ];

  return [...staticRoutes, ...dynamicRoutes];
}
