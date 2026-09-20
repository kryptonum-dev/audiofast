import 'server-only';

import { BLOG_ITEMS_PER_PAGE } from '../constants';

export const BLOG_SEARCH_API_VERSION = '2026-08-21';
export const BLOG_SEARCH_LIMIT = 50;
export const BLOG_SEARCH_PAGE_SIZE = BLOG_ITEMS_PER_PAGE;
export const BLOG_SEARCH_TIMEOUT_MS = 3000;
export const BLOG_SEARCH_MAX_LENGTH = 256;
export type BlogSearchBackend = 'legacy' | 'dataset' | 'lexical';

export function getBlogSearchBackend(): BlogSearchBackend {
  const value = process.env.SANITY_BLOG_SEARCH_BACKEND;
  if (!value) return 'legacy';
  if (value === 'legacy' || value === 'dataset' || value === 'lexical')
    return value;
  console.warn('[blog-search] Invalid backend; using lexical recovery');
  return 'lexical';
}

export function getBlogSearchClientConfig() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = process.env.SANITY_API_READ_TOKEN;
  if (!projectId || !token)
    throw new Error('Blog search read configuration missing');
  return {
    projectId,
    dataset,
    token,
    apiVersion: BLOG_SEARCH_API_VERSION,
    perspective: 'published' as const,
    useCdn: false,
    maxRetries: 0,
    timeout: BLOG_SEARCH_TIMEOUT_MS,
  };
}

export function normalizeBlogSearch(search: unknown, page: unknown) {
  const text = typeof search === 'string' ? search.trim() : '';
  const numericPage = Number(page);
  return {
    search: text.slice(0, BLOG_SEARCH_MAX_LENGTH),
    inputLimited: text.length > BLOG_SEARCH_MAX_LENGTH,
    page:
      Number.isSafeInteger(numericPage) && numericPage > 0 ? numericPage : 1,
  };
}
