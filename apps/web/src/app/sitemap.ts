import type { MetadataRoute } from 'next';

import { BASE_URL } from '@/global/constants';
import { sanityFetch } from '@/global/sanity/fetch';
import {
  queryAllBlogCategorySlugsForSitemap,
  queryAllBlogPostSlugsForSitemap,
  queryAllBrandSlugsForSitemap,
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
    products,
    reviews,
    blogCategories,
    productCategories,
  ] = await Promise.all([
    sanityFetch<SitemapEntry[]>({
      query: queryAllPageSlugsForSitemap,
      tags: ['page'],
    }),
    sanityFetch<SitemapEntry[]>({
      query: queryAllBlogPostSlugsForSitemap,
      tags: ['blog-article'],
    }),
    sanityFetch<SitemapEntry[]>({
      query: queryAllBrandSlugsForSitemap,
      tags: ['brand'],
    }),
    sanityFetch<SitemapEntry[]>({
      query: queryAllProductSlugsForSitemap,
      tags: ['product'],
    }),
    sanityFetch<SitemapEntry[]>({
      query: queryAllReviewSlugsForSitemap,
      tags: ['review'],
    }),
    sanityFetch<SitemapEntry[]>({
      query: queryAllBlogCategorySlugsForSitemap,
      tags: ['blog-category'],
    }),
    sanityFetch<SitemapEntry[]>({
      query: queryAllProductCategorySlugsForSitemap,
      tags: ['productCategorySub'],
    }),
  ]);

  // Static routes that are always present
  const staticRoutes = [
    '/',
    '/blog/',
    '/certyfikowany-sprzet-uzywany/',
    '/marki/',
    '/polityka-prywatnosci/',
    '/porownaj/',
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
