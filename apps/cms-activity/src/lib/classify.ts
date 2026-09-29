import type {
  ActivityAction,
  ActivityEvent,
  HistoryEffect,
  HistoryMutation,
  HistoryTransaction,
} from './types.js';

const DRAFTS_PREFIX = 'drafts.';
const VERSIONS_PREFIX = 'versions.';

/**
 * Published id of any document variant: strips `drafts.` and
 * `versions.<releaseId>.`.
 */
export function stripDraft(id: string): string {
  if (id.startsWith(DRAFTS_PREFIX)) return id.slice(DRAFTS_PREFIX.length);
  if (id.startsWith(VERSIONS_PREFIX)) {
    const rest = id.slice(VERSIONS_PREFIX.length);
    const dot = rest.indexOf('.');
    return dot === -1 ? rest : rest.slice(dot + 1);
  }
  return id;
}

/** Draft or release-version variant (both are "not yet published" copies). */
export function isDraftLikeId(id: string): boolean {
  return id.startsWith(DRAFTS_PREFIX) || id.startsWith(VERSIONS_PREFIX);
}

export type EffectKind = 'created' | 'deleted' | 'modified' | 'none';

/** A mendoza patch that starts with `[0, null]` sets the whole value to null. */
function startsWithNull(patch: unknown): boolean {
  return Array.isArray(patch) && patch[0] === 0 && patch[1] === null;
}

/**
 * Studio's own effect classification: `revert` resetting to null means the
 * document did not exist before (created); `apply` resetting to null means
 * it does not exist after (deleted); anything else is a modification.
 */
export function effectKind(effect: HistoryEffect | undefined): EffectKind {
  if (!effect) return 'none';
  const created = startsWithNull(effect.revert);
  const deleted = startsWithNull(effect.apply);
  if (created && deleted) return 'none'; // created and removed in one go
  if (created) return 'created';
  if (deleted) return 'deleted';
  return 'modified';
}

function mutationTarget(mutation: HistoryMutation): {
  id: string | undefined;
  op: string;
} {
  if (mutation.delete) return { id: mutation.delete.id, op: 'delete' };
  if (mutation.patch) return { id: mutation.patch.id, op: 'patch' };
  if (mutation.create) return { id: mutation.create._id, op: 'create' };
  if (mutation.createIfNotExists) {
    return { id: mutation.createIfNotExists._id, op: 'createIfNotExists' };
  }
  if (mutation.createOrReplace) {
    return { id: mutation.createOrReplace._id, op: 'createOrReplace' };
  }
  return { id: undefined, op: 'other' };
}

/**
 * Effect kind for one raw document id. Uses mendoza effects; when a
 * transaction carries no effect for that id, falls back to the mutation type.
 */
function kindFor(tx: HistoryTransaction, id: string): EffectKind {
  const effect = tx.effects?.[id];
  if (effect) return effectKind(effect);
  if (tx.effects && Object.keys(tx.effects).length > 0) return 'none';

  let kind: EffectKind = 'none';
  for (const mutation of tx.mutations ?? []) {
    const target = mutationTarget(mutation);
    if (target.id !== id) continue;
    if (target.op === 'delete') kind = 'deleted';
    else if (target.op === 'create') kind = 'created';
    else if (kind === 'none') kind = 'modified';
  }
  return kind;
}

function hasCreateIfNotExists(tx: HistoryTransaction, id: string): boolean {
  return (tx.mutations ?? []).some(
    (mutation) => mutation.createIfNotExists?._id === id,
  );
}

type Classified = { action: ActivityAction; direct?: boolean } | null;

/** Map the draft/published effect pair of one document to an action. */
export function classifyKinds(
  draft: EffectKind,
  published: EffectKind,
  options: { draftEnsured?: boolean } = {},
): Classified {
  const publishedWritten = published === 'created' || published === 'modified';

  if (publishedWritten && draft === 'deleted') return { action: 'publish' };
  if (published === 'deleted' && draft === 'created') {
    return { action: 'unpublish' };
  }
  // Studio's unpublish uses createIfNotExists on the draft; with an existing
  // draft that is a no-op, so the draft shows no effect at all.
  if (published === 'deleted' && draft === 'none' && options.draftEnsured) {
    return { action: 'unpublish' };
  }
  if (draft === 'deleted' && published === 'none') return { action: 'discard' };
  if (published === 'deleted') return { action: 'delete' };
  if (draft === 'created') return { action: 'create' };
  if (draft === 'modified') return { action: 'edit' };
  if (publishedWritten) return { action: 'edit', direct: true };
  return null;
}

/**
 * Convert one transaction into zero or more activity events, one per touched
 * published document, based on effect shapes only (so Studio actions, the
 * bulk-actions table and direct API writes classify alike).
 */
export function classifyTransaction(tx: HistoryTransaction): ActivityEvent[] {
  // Union of reported document ids and mutation targets: a no-op mutation
  // (e.g. `createIfNotExists` on an existing draft during unpublish) may be
  // missing from `documentIDs` but still matters for classification.
  const rawIds = new Set(tx.documentIDs ?? []);
  for (const mutation of tx.mutations ?? []) {
    const target = mutationTarget(mutation).id;
    if (target) rawIds.add(target);
  }

  const groups = new Map<string, string[]>();
  for (const id of rawIds) {
    const publishedId = stripDraft(id);
    const group = groups.get(publishedId);
    if (group) {
      if (!group.includes(id)) group.push(id);
    } else {
      groups.set(publishedId, [id]);
    }
  }

  const events: ActivityEvent[] = [];
  for (const [publishedId, ids] of groups) {
    let draft: EffectKind = 'none';
    let draftEnsured = false;
    let published: EffectKind = 'none';

    for (const id of ids) {
      if (isDraftLikeId(id)) {
        // Several draft-like variants in one transaction are rare; keep the
        // most significant kind.
        const kind = kindFor(tx, id);
        if (draft === 'none' || kind === 'deleted' || kind === 'created') {
          draft = kind === 'none' ? draft : kind;
        }
        draftEnsured ||= hasCreateIfNotExists(tx, id);
      } else {
        published = kindFor(tx, id);
      }
    }

    const classified = classifyKinds(draft, published, { draftEnsured });
    if (!classified) continue;

    events.push({
      id: `${tx.id}:${publishedId}`,
      at: tx.timestamp,
      lastAt: tx.timestamp,
      authorId: tx.author,
      documentId: publishedId,
      action: classified.action,
      ...(classified.direct ? { direct: true } : {}),
      mergedCount: 1,
      changedFields: [],
      transactionIds: [tx.id],
      touchedIds: [...ids].sort(),
    });
  }

  return events;
}

/** Classify many transactions; output is sorted ascending by time. */
export function classifyTransactions(
  transactions: readonly HistoryTransaction[],
): ActivityEvent[] {
  return transactions
    .flatMap(classifyTransaction)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
