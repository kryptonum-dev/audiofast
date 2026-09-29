import { applyPatch } from 'mendoza';

import { isDraftLikeId, stripDraft } from './classify.js';
import { throwIfAborted } from './concurrency.js';
import {
  changeKey,
  diffDocuments,
  formatChangedFields,
  type ChangedField,
} from './field-diff.js';
import {
  fetchDocumentTransactions,
  fetchSnapshots,
  type HistoryRequestClient,
} from './history-client.js';
import type { ActivityEvent, HistoryTransaction } from './types.js';

/** Shown in "Zmienione pola" when the document history could not be replayed. */
export const RECONSTRUCTION_FAILED = '(nie udało się odtworzyć)';

export type ReconstructConfig = {
  dataset: string;
  limits: {
    snapshotBatchSize: number;
    pageSize: number;
  };
};

export type ReconstructProgress = {
  /** Ready-to-show Polish status line. */
  message: string;
  loaded?: number;
  total?: number;
};

export type AttachChangedFieldsParams = {
  events: readonly ActivityEvent[];
  /** The selected author; only their transactions are diffed. */
  authorId: string;
  /** UTC ISO start of the report window (snapshot time). */
  fromTime: string;
  /** UTC ISO end of the report window. */
  toTime: string;
  signal?: AbortSignal;
  onProgress?: (progress: ReconstructProgress) => void;
};

type ReplayResult = {
  /** `txId|rawDocumentId` → changes made by that transaction. */
  diffs: Map<string, ChangedField[]>;
  /** `txId|rawDocumentId` whose effect could not be applied. */
  failures: Set<string>;
  /** Transaction ids present in the replayed chains. */
  seen: Set<string>;
  /** `txId|publishedId` → the published version existed before that tx. */
  publishedBefore: Map<string, boolean>;
};

function txKey(txId: string, id: string): string {
  return `${txId}|${id}`;
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function revisionOf(doc: unknown): string | undefined {
  if (!doc || typeof doc !== 'object') return undefined;
  const rev = (doc as { _rev?: unknown })._rev;
  return typeof rev === 'string' ? rev : undefined;
}

/**
 * Raw ids whose history is needed for the given events, ordered so that the
 * variants of one document (`X`, `drafts.X`, `versions.<r>.X`) stay adjacent
 * and usually share a request batch: a transaction that touches several of
 * them then arrives in one piece more often.
 */
function collectIds(events: readonly ActivityEvent[]): string[] {
  const ids = new Set<string>();
  for (const event of events) {
    ids.add(event.documentId);
    ids.add(`drafts.${event.documentId}`);
    for (const id of event.touchedIds) ids.add(id);
  }
  return [...ids].sort((a, b) => {
    const byDocument = stripDraft(a).localeCompare(stripDraft(b), 'en');
    return byDocument !== 0 ? byDocument : a.localeCompare(b, 'en');
  });
}

/**
 * Replay every transaction (all authors, ascending) on top of the snapshots
 * and diff the versions produced by the selected author's transactions.
 * A document whose chain breaks (patch cannot be applied) stops being
 * replayed; later transactions of the author on it are marked as failures.
 */
export function replayTransactions(
  snapshots: ReadonlyMap<string, unknown>,
  transactions: readonly HistoryTransaction[],
  options: { ids: readonly string[]; authorId: string },
): ReplayResult {
  const tracked = new Set(options.ids);
  const state = new Map<string, unknown>();
  for (const id of tracked) state.set(id, snapshots.get(id) ?? null);

  const broken = new Set<string>();
  const result: ReplayResult = {
    diffs: new Map(),
    failures: new Set(),
    seen: new Set(),
    publishedBefore: new Map(),
  };

  for (const tx of transactions) {
    const effects = tx.effects;
    if (!effects) continue;
    result.seen.add(tx.id);
    const byAuthor = tx.author === options.authorId;

    // Read every "before" state first: one transaction can touch the draft
    // and the published version, and both diffs need pre-transaction states.
    const before = new Map<string, unknown>();
    for (const id of Object.keys(effects)) {
      if (tracked.has(id)) before.set(id, state.get(id) ?? null);
    }
    if (byAuthor) {
      for (const id of before.keys()) {
        const publishedId = stripDraft(id);
        result.publishedBefore.set(
          txKey(tx.id, publishedId),
          (state.get(publishedId) ?? null) !== null,
        );
      }
    }

    for (const [id, prev] of before) {
      const effect = effects[id];
      if (!effect) continue;
      const key = txKey(tx.id, id);

      if (broken.has(id)) {
        if (byAuthor) result.failures.add(key);
        continue;
      }
      // Snapshot taken at the window start may already contain a boundary
      // transaction: never apply the same revision twice.
      if (revisionOf(prev) === tx.id) continue;

      let next: unknown;
      try {
        next = applyPatch(prev, effect.apply) as unknown;
      } catch {
        broken.add(id);
        if (byAuthor) result.failures.add(key);
        continue;
      }
      state.set(id, next ?? null);

      if (byAuthor) {
        // A draft created from nothing is usually Studio copying the
        // published version before the first edit: diff against that.
        const publishedId = stripDraft(id);
        const baseline =
          prev === null && isDraftLikeId(id)
            ? ((before.has(publishedId)
                ? before.get(publishedId)
                : state.get(publishedId)) ?? null)
            : prev;
        // A removed version (draft discarded on publish, deleted document)
        // says nothing about which fields the author worked on.
        result.diffs.set(
          key,
          next === null || next === undefined
            ? []
            : diffDocuments(baseline, next),
        );
      }
    }
  }

  return result;
}

/** Raw ids whose diff explains an event; empty for removal-type actions. */
function relevantIds(event: ActivityEvent): string[] {
  switch (event.action) {
    case 'publish':
      return [event.documentId];
    case 'edit':
      if (event.direct) return [event.documentId];
      return event.touchedIds.filter(isDraftLikeId);
    case 'create':
      return event.touchedIds.filter(isDraftLikeId);
    default:
      return [];
  }
}

function applyToEvent(
  event: ActivityEvent,
  replay: ReplayResult,
): ActivityEvent {
  const ids = relevantIds(event);
  let action = event.action;

  // Classification sees a created draft; if the published version already
  // existed, this was the first edit of a published document, not a create.
  const firstTx = event.transactionIds[0];
  if (
    action === 'create' &&
    firstTx &&
    replay.publishedBefore.get(txKey(firstTx, event.documentId)) === true
  ) {
    action = 'edit';
  }

  if (ids.length === 0) {
    return action === event.action ? event : { ...event, action };
  }

  const changes: ChangedField[] = [];
  const seenChanges = new Set<string>();
  let failed = false;

  for (const txId of event.transactionIds) {
    if (!replay.seen.has(txId)) {
      failed = true;
      continue;
    }
    for (const id of ids) {
      const key = txKey(txId, id);
      if (replay.failures.has(key)) {
        failed = true;
        continue;
      }
      for (const change of replay.diffs.get(key) ?? []) {
        const identity = changeKey(change);
        if (seenChanges.has(identity)) continue;
        seenChanges.add(identity);
        changes.push(change);
      }
    }
  }

  const formatted = formatChangedFields(changes, { typeHint: event.docType });
  const changedFields = [
    ...new Set([...event.changedFields, ...formatted]),
    ...(failed ? [RECONSTRUCTION_FAILED] : []),
  ];
  return { ...event, action, changedFields };
}

function markFailed(event: ActivityEvent): ActivityEvent {
  if (relevantIds(event).length === 0) return event;
  return { ...event, changedFields: [RECONSTRUCTION_FAILED] };
}

/**
 * Fill `changedFields` on the selected author's events: snapshot every
 * touched document (published and draft variants) at `fromTime`, fetch all
 * transactions on those documents in the window (every author, so each
 * mendoza patch lands on the exact previous version), replay them in order
 * and diff the versions produced by the author's transactions. Merged events
 * union the changes of all their transactions.
 *
 * Network failures do not fail the report: affected events get
 * `RECONSTRUCTION_FAILED` instead. Aborts propagate.
 */
export async function attachChangedFields(
  client: HistoryRequestClient,
  config: ReconstructConfig,
  params: AttachChangedFieldsParams,
): Promise<ActivityEvent[]> {
  const { events, authorId, fromTime, toTime, signal, onProgress } = params;
  if (events.length === 0) return [...events];

  const ids = collectIds(events);
  const batchCount = Math.ceil(ids.length / config.limits.snapshotBatchSize);
  let replay: ReplayResult;

  try {
    onProgress?.({
      message: `Odtwarzanie zmian: wersje początkowe (0/${batchCount} paczek)…`,
      loaded: 0,
      total: batchCount,
    });
    const snapshots = await fetchSnapshots(client, {
      dataset: config.dataset,
      ids,
      time: fromTime,
      batchSize: config.limits.snapshotBatchSize,
      signal,
      onProgress: (done, total) =>
        onProgress?.({
          message: `Odtwarzanie zmian: wersje początkowe (${done}/${total} paczek)…`,
          loaded: done,
          total,
        }),
    });
    throwIfAborted(signal);

    const chains = await fetchDocumentTransactions(client, {
      dataset: config.dataset,
      ids,
      fromTime,
      toTime,
      batchSize: config.limits.snapshotBatchSize,
      pageSize: config.limits.pageSize,
      signal,
      onProgress: (done, total) =>
        onProgress?.({
          message: `Odtwarzanie zmian: historia dokumentów (${done}/${total} paczek)…`,
          loaded: done,
          total,
        }),
    });
    throwIfAborted(signal);

    onProgress?.({
      message: `Porównywanie wersji (${chains.transactions.length} transakcji)…`,
    });
    replay = replayTransactions(snapshots, chains.transactions, {
      ids,
      authorId,
    });
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    // The report still renders; leave a trace for whoever debugs the marker.
    console.warn(
      'cms-activity: changed fields could not be reconstructed',
      error,
    );
    return events.map(markFailed);
  }

  return events.map((event) =>
    event.authorId === authorId ? applyToEvent(event, replay) : event,
  );
}
