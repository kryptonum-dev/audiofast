import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';

import { ArticleBody } from '@/src/components/blog/ArticleBody';
import BlogPostSchema from '@/src/components/schema/BlogPostSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { limitBuildTimeStaticParams } from '@/src/global/build';
import { logWarn } from '@/src/global/logger';
import { getDataAttribute } from '@/src/global/sanity/data-attribute';
import {
  type CachedProps,
  renderDraftAware,
} from '@/src/global/sanity/draft-aware';
import {
  type DynamicFetchOptions,
  PUBLISHED,
  sanityFetchCached,
  sanityFetchPublished,
  sanityFetchStaticParams,
} from '@/src/global/sanity/live';
import {
  queryAllBlogPostSlugs,
  queryBlogPostBySlug,
  querySettings,
} from '@/src/global/sanity/query';
import type {
  QueryAllBlogPostSlugsResult,
  QueryBlogPostBySlugResult,
  QuerySettingsResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

// Shared cached data function: metadata (PUBLISHED) and the published page
// render read the same entry, so the old SEO-only query is gone.
function getBlogPostData(slug: string, options: DynamicFetchOptions) {
  return sanityFetchCached<QueryBlogPostBySlugResult>({
    requestTag: 'blog-article.page',
    query: queryBlogPostBySlug,
    params: { slug: `/blog/${slug}/` },
    ...options,
    // Specific tag for this article + broad tag for type
    tags: ['blog-article', `blog-article:${slug}`],
  });
}

export async function generateStaticParams() {
  const posts = await sanityFetchStaticParams<QueryAllBlogPostSlugsResult>({
    requestTag: 'blog-article.static-params',
    query: queryAllBlogPostSlugs,
    tags: ['blog-article'],
  });

  return limitBuildTimeStaticParams(
    posts
      .filter((post) => post.slug)
      .map((post) => ({
        slug: post.slug!.replace('/blog/', '').replace(/\/$/, ''),
      })),
    { slug: '__placeholder__' },
  );
}

export async function generateMetadata(props: BlogPostPageProps) {
  const { slug } = await props.params;
  const pageData = await getBlogPostData(slug, PUBLISHED);

  if (!pageData) {
    logWarn(`Blog post SEO data not found for slug: ${slug}`);
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
    noNotIndex: pageData.doNotIndex,
  });
}

export default async function BlogPostPage(props: BlogPostPageProps) {
  const { slug } = await props.params;
  return renderDraftAware(CachedBlogPost, { slug });
}

async function CachedBlogPost({
  slug,
  perspective,
  stega,
  isDraft,
}: CachedProps & { slug: string }) {
  'use cache';
  cacheLife('sanity');
  const pageData = await getBlogPostData(slug, { perspective, stega });

  if (!pageData) {
    logWarn(`Blog post data not found for slug: ${slug}, returning 404`);
    notFound();
  }

  // Publisher info for the JSON-LD: published-only, never stega-encoded.
  const settings = await sanityFetchPublished<QuerySettingsResult>({
    requestTag: 'blog-article.settings',
    query: querySettings,
    tags: ['settings'],
  });

  const breadcrumbsData = [
    {
      name: 'Blog',
      path: '/blog',
    },
    {
      name: pageData.name!,
      path: pageData.slug!,
    },
  ];

  return (
    <main id="main" className="page-transition">
      <BlogPostSchema blogPost={pageData} settings={settings} />
      <Breadcrumbs data={breadcrumbsData} />
      <ArticleBody
        {...pageData}
        contentDataAttribute={getDataAttribute({
          id: pageData._id,
          type: pageData._type,
          isDraft,
        })?.scope('content')}
      />
      {pageData.pageBuilder && pageData.pageBuilder.length > 0 && (
        <PageBuilder
          pageBuilder={pageData.pageBuilder}
          indexOffset={1}
          fetchOptions={{ perspective, stega }}
          documentId={pageData._id}
          documentType={pageData._type}
          isDraft={isDraft}
        />
      )}
    </main>
  );
}
