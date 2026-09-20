import 'server-only';

import type { EmbeddingsResponse } from '@/src/global/types';

/**
 * Temporary server-only rollback helper for the legacy Embeddings Index API
 * @param searchQuery - The search query string
 * @param type - The type of content to search ('products' or 'blog')
 * @returns Array of embedding results with scores and document IDs, or null if no query or error
 * @example
 * const results = await fetchEmbeddings('wireless headphones', 'products');
 * // Returns: [{ score: 0.92, value: { documentId: 'abc123', type: 'product' } }, ...]
 */
export async function fetchEmbeddings(
  searchQuery: string,
  type: 'products' | 'blog',
): Promise<EmbeddingsResponse | null> {
  if (!searchQuery || !searchQuery.trim()) {
    return null;
  }

  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
    const bearerToken = process.env.EMBEDDINGS_INDEX_BEARER_TOKEN;

    if (!projectId || !bearerToken) {
      console.error('Missing required environment variables for embeddings');
      return null;
    }

    const indexName = type === 'products' ? 'products' : 'blog';
    const typeFilter = type === 'products' ? 'product' : 'blog-article';

    const embeddingsUrl = `https://${projectId}.api.sanity.io/vX/embeddings-index/query/${dataset}/${indexName}`;

    const response = await fetch(embeddingsUrl, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        query: searchQuery.trim(),
        maxResults: 50,
        filter: {
          _type: [typeFilter],
        },
      }),
    });

    if (!response.ok) {
      console.warn('[blog-search] Legacy request failed', {
        status: response.status,
      });
      return null;
    }

    const data: unknown = await response.json();
    if (
      !Array.isArray(data) ||
      data.length > 50 ||
      !data.every(
        (item) =>
          item &&
          typeof item.score === 'number' &&
          Number.isFinite(item.score) &&
          typeof item.value?.documentId === 'string' &&
          item.value.type === typeFilter &&
          !item.value.documentId.startsWith('drafts.') &&
          !item.value.documentId.startsWith('versions.'),
      )
    )
      return null;
    return data as EmbeddingsResponse;
  } catch {
    console.warn('[blog-search] Legacy request unavailable');
    return null;
  }
}
