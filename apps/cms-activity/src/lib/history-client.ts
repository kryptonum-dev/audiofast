import { parseNdjson } from './ndjson.js';
import type { HistoryTransaction } from './types.js';

/**
 * Minimal structural client surface (a subset of `SanityClient.request`), so
 * this module stays framework-free and any `@sanity/client` instance fits.
 */
export type HistoryRequestClient = {
  request<R>(options: {
    uri: string;
    query?: Record<string, string | string[]>;
    signal?: AbortSignal;
  }): Promise<R>;
};

export type FetchTransactionsPageParams = {
  dataset: string;
  authors?: string[];
  /**
   * UTC ISO timestamp, lower bound. Boundary inclusivity is not documented,
   * so pagers must de-duplicate by transaction id.
   */
  fromTime: string;
  /** UTC ISO timestamp, upper bound (same caveat as `fromTime`). */
  toTime: string;
  limit: number;
  signal?: AbortSignal;
};

/**
 * Fetch one page of dataset-wide transactions (ids-only mutations, mendoza
 * effects). The client must be bound to the project host; the API version
 * prefix comes from the client config.
 */
export async function fetchTransactionsPage(
  client: HistoryRequestClient,
  params: FetchTransactionsPageParams,
): Promise<HistoryTransaction[]> {
  const { dataset, authors, fromTime, toTime, limit, signal } = params;

  const raw = await client.request<unknown>({
    uri: `/data/history/${encodeURIComponent(dataset)}/transactions`,
    query: {
      excludeContent: 'true',
      effectFormat: 'mendoza',
      fromTime,
      toTime,
      limit: String(limit),
      ...(authors && authors.length > 0 ? { authors: authors.join(',') } : {}),
    },
    signal,
  });

  return parseNdjson<HistoryTransaction>(raw);
}
