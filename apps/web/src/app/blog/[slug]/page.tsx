import { notFound } from 'next/navigation';

import { ArticleBody } from '@/src/components/shared/ArticleBody';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/client';
import {
  queryAllBlogPostSlugs,
  queryBlogPostBySlug,
} from '@/src/global/sanity/query';
import type {
  QueryAllBlogPostSlugsResult,
  QueryBlogPostBySlugResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

async function fetchBlogPostData(slug: string) {
  return await sanityFetch<QueryBlogPostBySlugResult>({
    query: queryBlogPostBySlug,
    params: { slug: `/blog/${slug}/` },
    tags: ['blog-article', slug],
  });
}

export async function generateStaticParams() {
  const posts = await sanityFetch<QueryAllBlogPostSlugsResult>({
    query: queryAllBlogPostSlugs,
    tags: ['blog-article'],
  });

  return posts.map((post) => ({
    slug: post.slug!.replace('/blog/', ''),
  }));
}

export async function generateMetadata(props: BlogPostPageProps) {
  const { slug } = await props.params;
  const pageData = await fetchBlogPostData(slug);

  if (!pageData) {
    logWarn(`Blog post data not found for slug: ${slug}`);
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
  });
}

export default async function BlogPostPage(props: BlogPostPageProps) {
  const { slug } = await props.params;

  const pageData = await fetchBlogPostData(slug);

  if (!pageData) {
    logWarn(`Blog post data not found for slug: ${slug}, returning 404`);
    notFound();
  }

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
      <Breadcrumbs data={breadcrumbsData} />
      <ArticleBody {...pageData} />
      {pageData.pageBuilder && pageData.pageBuilder.length > 0 && (
        <PageBuilder pageBuilder={pageData.pageBuilder} />
      )}
    </main>
  );
}
