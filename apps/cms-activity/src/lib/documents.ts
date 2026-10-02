import { chunk, mapWithConcurrency } from './concurrency.js';
import {
  fetchLastRevision,
  HISTORY_CONCURRENCY,
  type HistoryRequestClient,
} from './history-client.js';
import { documentImageRef, IMAGE_REF_GROQ } from './images.js';
import type { ResolvedDocument, SanityDocumentLike } from './types.js';

const DRAFTS_PREFIX = 'drafts.';
const QUERY_BATCH_SIZE = 200;

/**
 * Raw naming fields; the name itself is computed in `documentName` so the same
 * rules apply to live documents and to last revisions of deleted ones.
 * Mirrors the plan's `coalesce(product brand + name, name, pt::text(title),
 * question, heading, label)`.
 */
const NAMES_QUERY = `*[_id in $ids]{
  _id,
  _type,
  name,
  title,
  question,
  heading,
  label,
  "brandName": select(_type == "product" => brand->name),
  "imageRef": ${IMAGE_REF_GROQ}
}`;

type NameFields = {
  _id: string;
  _type: string;
  name?: unknown;
  title?: unknown;
  question?: unknown;
  heading?: unknown;
  label?: unknown;
  brandName?: unknown;
  imageRef?: unknown;
};

function imageRefOf(doc: NameFields | undefined): string | null {
  return typeof doc?.imageRef === 'string' && doc.imageRef !== ''
    ? doc.imageRef
    : null;
}

/** Plain text of a string or a Portable Text value (like GROQ `pt::text`). */
export function toPlainText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (!Array.isArray(value)) return null;
  const text = value
    .map((block) => {
      if (!block || typeof block !== 'object') return '';
      const children = (block as { children?: unknown }).children;
      if (!Array.isArray(children)) return '';
      return children
        .map((child) =>
          child && typeof (child as { text?: unknown }).text === 'string'
            ? (child as { text: string }).text
            : '',
        )
        .join('');
    })
    .filter((line) => line !== '')
    .join(' ')
    .trim();
  return text === '' ? null : text;
}

/** Human-readable document name, or null when the document has none. */
export function documentName(doc: NameFields): string | null {
  const name = toPlainText(doc.name);
  const brand = toPlainText(doc.brandName);
  if (doc._type === 'product' && name && brand) return `${brand} ${name}`;
  return (
    name ??
    toPlainText(doc.title) ??
    toPlainText(doc.question) ??
    toPlainText(doc.heading) ??
    toPlainText(doc.label)
  );
}

async function queryNames(
  client: HistoryRequestClient,
  dataset: string,
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<NameFields[]> {
  const response = await client.request<{ result?: unknown }>({
    uri: `/data/query/${encodeURIComponent(dataset)}`,
    method: 'POST',
    // `raw` so drafts are returned next to published documents.
    query: { perspective: 'raw' },
    body: { query: NAMES_QUERY, params: { ids } },
    signal,
  });
  const result = response?.result;
  return Array.isArray(result) ? (result as NameFields[]) : [];
}

export type ResolveDocumentsParams = {
  dataset: string;
  /** Published ids (without `drafts.`). */
  ids: readonly string[];
  signal?: AbortSignal;
  onProgress?: (resolved: number, total: number) => void;
};

/**
 * Resolve name, type and thumbnail image for every touched document. Queries both the
 * published and the draft id (the draft name wins, as that is what the editor
 * sees), then falls back to the last revision from the History API for
 * documents that no longer exist (`deleted: true`).
 */
export async function resolveDocuments(
  client: HistoryRequestClient,
  params: ResolveDocumentsParams,
): Promise<Map<string, ResolvedDocument>> {
  const { dataset, signal } = params;
  const ids = [...new Set(params.ids)];
  const resolved = new Map<string, ResolvedDocument>();
  const batches = chunk(ids, QUERY_BATCH_SIZE);
  let done = 0;

  await mapWithConcurrency(batches, HISTORY_CONCURRENCY, async (batch) => {
    const queryIds = batch.flatMap((id) => [id, `${DRAFTS_PREFIX}${id}`]);
    const docs = await queryNames(client, dataset, queryIds, signal);
    const published = new Map<string, NameFields>();
    const drafts = new Map<string, NameFields>();
    for (const doc of docs) {
      if (doc._id.startsWith(DRAFTS_PREFIX)) {
        drafts.set(doc._id.slice(DRAFTS_PREFIX.length), doc);
      } else {
        published.set(doc._id, doc);
      }
    }
    for (const id of batch) {
      const draft = drafts.get(id);
      const pub = published.get(id);
      if (!draft && !pub) continue;
      resolved.set(id, {
        name:
          (draft && documentName(draft)) ?? (pub && documentName(pub)) ?? null,
        type: draft?._type ?? pub?._type ?? null,
        imageRef: imageRefOf(draft) ?? imageRefOf(pub),
        deleted: false,
      });
    }
    done += batch.length;
    params.onProgress?.(done, ids.length);
  });

  const missing = ids.filter((id) => !resolved.has(id));
  await mapWithConcurrency(missing, HISTORY_CONCURRENCY, async (id) => {
    // The published id is the usual last revision; a never-published
    // document that was discarded only exists as a draft.
    const revision: SanityDocumentLike | null =
      (await fetchLastRevision(client, { dataset, id, signal })) ??
      (await fetchLastRevision(client, {
        dataset,
        id: `${DRAFTS_PREFIX}${id}`,
        signal,
      }));
    resolved.set(id, {
      name: revision ? documentName(revision) : null,
      type: revision?._type ?? null,
      imageRef: revision ? documentImageRef(revision) : null,
      deleted: true,
    });
  });

  return resolved;
}

/** Studio deep link that opens a document in its editor. */
export function studioEditUrl(
  studioUrl: string,
  id: string,
  type: string,
): string {
  const base = studioUrl.replace(/\/+$/, '');
  return `${base}/intent/edit/id=${encodeURIComponent(id)};type=${encodeURIComponent(type)}`;
}
