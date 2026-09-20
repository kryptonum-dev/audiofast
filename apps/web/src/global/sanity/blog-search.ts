import 'server-only';

import { createClient } from '@sanity/client';

import { fetchEmbeddings } from '@/src/app/actions/embeddings';

import {
  BLOG_SEARCH_LIMIT,
  BLOG_SEARCH_PAGE_SIZE,
  BLOG_SEARCH_TIMEOUT_MS,
  type BlogSearchBackend,
  getBlogSearchBackend,
  getBlogSearchClientConfig,
  normalizeBlogSearch,
} from './blog-search-config';
import {
  queryBlogArticlesRelevance,
  queryBlogLexicalSearch,
  queryBlogSemanticSearch,
} from './query';
import type { QueryBlogArticlesNewestResult } from './sanity.types';

type Article = QueryBlogArticlesNewestResult['articles'][number];
type Outcome = 'success' | 'empty' | 'unavailable' | 'input-limit' | 'browse';
export type BlogSearchResult = {
  articles: Article[];
  totalCount: number;
  backend: BlogSearchBackend;
  outcome: Outcome;
};

// Validate the public card boundary even when a remote response is malformed.
function parseArticles(value: unknown): Article[] {
  if (!Array.isArray(value) || value.length > BLOG_SEARCH_LIMIT)
    throw new Error('Invalid search response');
  const ids = new Set<string>();
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item._id !== 'string' ||
      !item._id ||
      ids.has(item._id) ||
      /^(drafts|versions)\./.test(item._id) ||
      item._type !== 'blog-article' ||
      typeof item.slug !== 'string' ||
      !item.slug.startsWith('/') ||
      typeof item._createdAt !== 'string' ||
      typeof item._score !== 'number' ||
      !Number.isFinite(item._score) ||
      (item.title !== null &&
        (!Array.isArray(item.title) ||
          item.title.some(
            (block: { children?: unknown }) =>
              !block || !Array.isArray(block.children),
          )))
    ) {
      throw new Error('Invalid search article');
    }
    ids.add(item._id);
  }
  return value as Article[];
}

async function fetchArticles(
  query: string,
  params: Record<string, unknown>,
  legacy = false,
) {
  // Old deployments can still roll back before the new server-only token is provisioned.
  const config =
    legacy && !process.env.SANITY_API_READ_TOKEN
      ? {
          projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
          dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
          apiVersion: '2026-08-21',
          token: process.env.NEXT_PUBLIC_SANITY_API_READ_TOKEN,
          useCdn: false,
          perspective: 'published' as const,
          maxRetries: 0,
        }
      : getBlogSearchClientConfig();
  const client = createClient(config);
  return client.fetch<unknown>(query, params, {
    cache: 'no-store',
    signal: AbortSignal.timeout(BLOG_SEARCH_TIMEOUT_MS),
  });
}

function warn(
  backend: BlogSearchBackend,
  outcome: Outcome,
  started: number,
  error?: unknown,
) {
  const status =
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
      ? error.statusCode
      : undefined;
  console.warn('[blog-search] Recovery', {
    backend,
    outcome,
    status,
    elapsedMs: Date.now() - started,
  });
}

export async function searchBlogArticles(input: {
  search: unknown;
  page?: unknown;
  category?: string;
  year?: string;
}): Promise<BlogSearchResult> {
  const normalized = normalizeBlogSearch(input.search, input.page);
  let backend = getBlogSearchBackend();
  let outcome: Outcome = normalized.inputLimited ? 'input-limit' : 'success';
  if (!normalized.search)
    return { articles: [], totalCount: 0, backend, outcome: 'browse' };
  if (normalized.inputLimited) backend = 'lexical';
  const params = {
    search: normalized.search,
    category: input.category || '',
    year: input.year || '',
  };
  let articles: Article[] | undefined;
  const started = Date.now();
  if (backend !== 'lexical') {
    try {
      if (backend === 'dataset') {
        articles = parseArticles(
          await fetchArticles(queryBlogSemanticSearch, params),
        );
      } else {
        const embeddingResults = await fetchEmbeddings(
          normalized.search,
          'blog',
        );
        if (!embeddingResults) throw new Error('Legacy unavailable');
        if (!embeddingResults.length) articles = [];
        else {
          const data = await fetchArticles(
            queryBlogArticlesRelevance,
            {
              ...params,
              embeddingResults,
              offset: 0,
              limit: BLOG_SEARCH_LIMIT,
            },
            true,
          );
          if (!data || typeof data !== 'object' || !('articles' in data))
            throw new Error('Invalid legacy hydration');
          // Preserve the old post-filtered candidate behavior during rollback.
          articles = parseArticles(data.articles);
          return pageResult(articles, normalized.page, backend, 'success');
        }
      }
      if (articles.length)
        return pageResult(articles, normalized.page, backend, 'success');
      outcome = 'empty';
    } catch (error) {
      outcome = 'unavailable';
      warn(backend, outcome, started, error);
    }
  }
  try {
    articles = parseArticles(
      await fetchArticles(queryBlogLexicalSearch, params),
    );
    return pageResult(articles, normalized.page, 'lexical', outcome);
  } catch (error) {
    warn('lexical', 'unavailable', started, error);
    // Do not expose upstream errors (which may contain requests or credentials).
    throw new Error('Blog search is temporarily unavailable');
  }
}

function pageResult(
  articles: Article[],
  page: number,
  backend: BlogSearchBackend,
  outcome: Outcome,
): BlogSearchResult {
  const offset = (page - 1) * BLOG_SEARCH_PAGE_SIZE;
  return {
    articles:
      offset >= articles.length
        ? []
        : articles.slice(offset, offset + BLOG_SEARCH_PAGE_SIZE),
    totalCount: articles.length,
    backend,
    outcome,
  };
}
