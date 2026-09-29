import { chunk, mapWithConcurrency, throwIfAborted } from './concurrency.js';
import { assertNotError, HistoryApiError, parseNdjson } from './ndjson.js';
import type { HistoryTransaction, SanityDocumentLike } from './types.js';

/**
 * Minimal structural client surface (a subset of `SanityClient.request`), so
 * this module stays framework-free and any `@sanity/client` instance fits.
 * The client must be bound to the project host; the API version prefix comes
 * from the client config.
 */
export type HistoryRequestClient = {
  request<R>(options: {
    uri: string;
    method?: string;
    query?: Record<string, string | string[]>;
    body?: unknown;
    signal?: AbortSignal;
  }): Promise<R>;
};

/** Hard stop for any paged transaction listing (100 x pageSize transactions). */
export const MAX_TRANSACTION_PAGES = 100;

/** Parallel requests for batched snapshot / per-document calls. */
export const HISTORY_CONCURRENCY = 3;

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

const TRANSACTION_QUERY = {
  excludeContent: 'true',
  effectFormat: 'mendoza',
} as const;

function datasetPath(dataset: string): string {
  return `/data/history/${encodeURIComponent(dataset)}`;
}

function idList(ids: readonly string[]): string {
  return ids.map((id) => encodeURIComponent(id)).join(',');
}

/**
 * Fetch one page of dataset-wide transactions (ids-only mutations, mendoza
 * effects).
 */
export async function fetchTransactionsPage(
  client: HistoryRequestClient,
  params: FetchTransactionsPageParams,
): Promise<HistoryTransaction[]> {
  const { dataset, authors, fromTime, toTime, limit, signal } = params;

  const raw = await client.request<unknown>({
    uri: `${datasetPath(dataset)}/transactions`,
    query: {
      ...TRANSACTION_QUERY,
      fromTime,
      toTime,
      limit: String(limit),
      ...(authors && authors.length > 0 ? { authors: authors.join(',') } : {}),
    },
    signal,
  });

  return parseNdjson<HistoryTransaction>(raw);
}

export type PagedTransactions = {
  /** De-duplicated by id, ascending by timestamp. */
  transactions: HistoryTransaction[];
  /** True when paging stopped before the API ran out of results. */
  truncated: boolean;
  pages: number;
};

function byTimestamp(a: HistoryTransaction, b: HistoryTransaction): number {
  const diff = Date.parse(a.timestamp) - Date.parse(b.timestamp);
  if (diff !== 0) return diff;
  return (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0);
}

/**
 * Generic time-based pager: call `fetchPage(fromTime)` with the last seen
 * timestamp as the next lower bound, de-duplicate by id, stop when a page is
 * shorter than `pageSize` or yields no new ids, and never exceed
 * `MAX_TRANSACTION_PAGES`.
 */
async function pageByTime(
  fromTime: string,
  pageSize: number,
  fetchPage: (fromTime: string) => Promise<HistoryTransaction[]>,
  options: {
    signal?: AbortSignal;
    onPage?: (loaded: number, page: number) => void;
  } = {},
): Promise<PagedTransactions> {
  const seen = new Map<string, HistoryTransaction>();
  let cursor = fromTime;
  let pages = 0;
  let truncated = false;

  for (;;) {
    throwIfAborted(options.signal);
    if (pages >= MAX_TRANSACTION_PAGES) {
      truncated = true;
      break;
    }

    const page = await fetchPage(cursor);
    pages += 1;

    let added = 0;
    let last: HistoryTransaction | undefined;
    for (const tx of page) {
      if (!tx || typeof tx.id !== 'string') continue;
      if (!last || Date.parse(tx.timestamp) > Date.parse(last.timestamp)) {
        last = tx;
      }
      if (seen.has(tx.id)) continue;
      seen.set(tx.id, tx);
      added += 1;
    }
    options.onPage?.(seen.size, pages);

    if (page.length < pageSize) break;
    if (added === 0 || !last) {
      // A full page with nothing new: more transactions share one timestamp
      // than fit in a page, so time-based paging cannot advance.
      truncated = true;
      break;
    }
    cursor = last.timestamp;
  }

  return {
    transactions: [...seen.values()].sort(byTimestamp),
    truncated,
    pages,
  };
}

export type FetchAllTransactionsParams = {
  dataset: string;
  authors?: string[];
  fromTime: string;
  toTime: string;
  pageSize: number;
  signal?: AbortSignal;
  /** Called after every page with the running count of unique transactions. */
  onProgress?: (loaded: number) => void;
};

/** Page the dataset-wide transaction list for the given authors and window. */
export async function fetchAllTransactions(
  client: HistoryRequestClient,
  params: FetchAllTransactionsParams,
): Promise<PagedTransactions> {
  const { dataset, authors, fromTime, toTime, pageSize, signal, onProgress } =
    params;

  return pageByTime(
    fromTime,
    pageSize,
    (cursor) =>
      fetchTransactionsPage(client, {
        dataset,
        authors,
        fromTime: cursor,
        toTime,
        limit: pageSize,
        signal,
      }),
    { signal, onPage: (loaded) => onProgress?.(loaded) },
  );
}

export type FetchDocumentTransactionsParams = {
  dataset: string;
  /** Raw document ids (published and draft variants), all authors. */
  ids: readonly string[];
  fromTime: string;
  toTime: string;
  /** Ids per request. */
  batchSize: number;
  /** Transactions per page within one batch. */
  pageSize: number;
  signal?: AbortSignal;
  /** Called after each finished batch. */
  onProgress?: (doneBatches: number, totalBatches: number) => void;
};

/**
 * Fetch every transaction (all authors) touching the given documents in the
 * window, via `/transactions/{ids}` with `includeIdentifiedDocumentsOnly`.
 * Ids are batched; each batch is paged like the dataset-wide listing. The
 * result is de-duplicated across batches and sorted ascending.
 */
export async function fetchDocumentTransactions(
  client: HistoryRequestClient,
  params: FetchDocumentTransactionsParams,
): Promise<PagedTransactions> {
  const { dataset, ids, fromTime, toTime, batchSize, pageSize, signal } =
    params;
  const batches = chunk([...new Set(ids)], batchSize);
  let done = 0;

  const results = await mapWithConcurrency(
    batches,
    HISTORY_CONCURRENCY,
    async (batch) => {
      const result = await pageByTime(
        fromTime,
        pageSize,
        async (cursor) => {
          const raw = await client.request<unknown>({
            uri: `${datasetPath(dataset)}/transactions/${idList(batch)}`,
            query: {
              ...TRANSACTION_QUERY,
              includeIdentifiedDocumentsOnly: 'true',
              fromTime: cursor,
              toTime,
              limit: String(pageSize),
            },
            signal,
          });
          return parseNdjson<HistoryTransaction>(raw);
        },
        { signal },
      );
      done += 1;
      params.onProgress?.(done, batches.length);
      return result;
    },
  );

  const merged = new Map<string, HistoryTransaction>();
  let truncated = false;
  let pages = 0;
  for (const result of results) {
    truncated ||= result.truncated;
    pages += result.pages;
    for (const tx of result.transactions) merged.set(tx.id, tx);
  }

  return {
    transactions: [...merged.values()].sort(byTimestamp),
    truncated,
    pages,
  };
}

type DocumentsResponse = { documents?: unknown };

function readDocuments(raw: unknown): SanityDocumentLike[] {
  let body: unknown = raw;
  if (typeof raw === 'string') {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new HistoryApiError(
        'Nie udało się odczytać odpowiedzi History API',
      );
    }
  }
  assertNotError(body);
  const documents = (body as DocumentsResponse | null)?.documents;
  if (!Array.isArray(documents)) return [];
  return documents.filter(
    (doc): doc is SanityDocumentLike =>
      !!doc &&
      typeof doc === 'object' &&
      typeof (doc as { _id?: unknown })._id === 'string',
  );
}

export type FetchSnapshotsParams = {
  dataset: string;
  ids: readonly string[];
  /** UTC ISO timestamp the documents are read at. */
  time: string;
  batchSize: number;
  signal?: AbortSignal;
  onProgress?: (doneBatches: number, totalBatches: number) => void;
};

/**
 * Read documents as they were at `time`. Ids of documents that did not exist
 * at that moment are absent from the returned map.
 */
export async function fetchSnapshots(
  client: HistoryRequestClient,
  params: FetchSnapshotsParams,
): Promise<Map<string, SanityDocumentLike>> {
  const { dataset, ids, time, batchSize, signal } = params;
  const batches = chunk([...new Set(ids)], batchSize);
  const snapshots = new Map<string, SanityDocumentLike>();
  let done = 0;

  await mapWithConcurrency(batches, HISTORY_CONCURRENCY, async (batch) => {
    const raw = await client.request<unknown>({
      uri: `${datasetPath(dataset)}/documents/${idList(batch)}`,
      query: { time },
      signal,
    });
    for (const doc of readDocuments(raw)) snapshots.set(doc._id, doc);
    done += 1;
    params.onProgress?.(done, batches.length);
  });

  return snapshots;
}

function isNotFound(error: unknown): boolean {
  if (error instanceof HistoryApiError) return error.statusCode === 404;
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { statusCode?: unknown }).statusCode === 404
  );
}

/**
 * Last known revision of a (possibly deleted) document, or null when the
 * History API has nothing for that id.
 */
export async function fetchLastRevision(
  client: HistoryRequestClient,
  params: { dataset: string; id: string; signal?: AbortSignal },
): Promise<SanityDocumentLike | null> {
  try {
    const raw = await client.request<unknown>({
      uri: `${datasetPath(params.dataset)}/documents/${encodeURIComponent(params.id)}`,
      query: { lastRevision: 'true' },
      signal: params.signal,
    });
    return readDocuments(raw)[0] ?? null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}
