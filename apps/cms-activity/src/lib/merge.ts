import { mergeFieldChanges } from './field-diff.js';
import type { ActivityEvent } from './types.js';

/** Denorm draft patch lands right before the product publish (sync commit). */
export const DENORM_PREPUBLISH_WINDOW_MS = 5_000;

/** Review publish recounts `reviewAuthor` documents ~0.8 s later. */
export const REVIEW_AUTHOR_SYNC_WINDOW_MS = 3_000;

const REVIEW_TYPE = 'review';
const REVIEW_AUTHOR_TYPE = 'reviewAuthor';

function ms(iso: string): number {
  return Date.parse(iso);
}

function byTime(a: ActivityEvent, b: ActivityEvent): number {
  return ms(a.at) - ms(b.at);
}

function union(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])];
}

/**
 * (a) An `edit` on a document that the same author publishes within
 * `DENORM_PREPUBLISH_WINDOW_MS` afterwards is the Studio's pre-publish patch
 * (denormalized fields, or the final autosave flushed by the publish action).
 */
function isPrePublishPatch(
  event: ActivityEvent,
  index: number,
  sorted: readonly ActivityEvent[],
): boolean {
  if (event.action !== 'edit' || event.direct) return false;
  const start = ms(event.lastAt);
  for (let i = index + 1; i < sorted.length; i += 1) {
    const next = sorted[i];
    if (!next) break;
    if (ms(next.at) - start > DENORM_PREPUBLISH_WINDOW_MS) break;
    if (
      next.action === 'publish' &&
      next.documentId === event.documentId &&
      next.authorId === event.authorId
    ) {
      return true;
    }
  }
  return false;
}

/**
 * (b) An `edit` (draft or direct) on a `reviewAuthor` document within
 * `REVIEW_AUTHOR_SYNC_WINDOW_MS` after the same author published a `review`
 * is the Studio's automatic review-count sync.
 */
function isReviewAuthorSync(
  event: ActivityEvent,
  index: number,
  sorted: readonly ActivityEvent[],
): boolean {
  if (event.action !== 'edit' || event.docType !== REVIEW_AUTHOR_TYPE) {
    return false;
  }
  const at = ms(event.at);
  for (let i = index - 1; i >= 0; i -= 1) {
    const prev = sorted[i];
    if (!prev) break;
    if (at - ms(prev.at) > REVIEW_AUTHOR_SYNC_WINDOW_MS) break;
    if (
      prev.action === 'publish' &&
      prev.docType === REVIEW_TYPE &&
      prev.authorId === event.authorId
    ) {
      return true;
    }
  }
  return false;
}

function isMergeable(event: ActivityEvent): boolean {
  return event.action === 'edit' || event.action === 'create';
}

/**
 * Remove Studio side effects and collapse autosaves. Run after `docType` is
 * known on every event. Input order does not matter; output is ascending.
 *
 * (c) Consecutive `edit`/`create` events on the same document by the same
 * author, each within `mergeWindowMinutes` of the previous one and with no
 * other action on that document in between, become one event: `at` = first,
 * `lastAt` = last, `mergedCount` summed, `changedFields`, `fieldChanges`,
 * `transactionIds` and `touchedIds` unioned. Direct (published) edits only
 * merge with direct edits. The action of the first event wins (`create` +
 * edits = `create`).
 */
export function mergeNoise(
  events: readonly ActivityEvent[],
  options: { mergeWindowMinutes: number },
): ActivityEvent[] {
  const sorted = [...events].sort(byTime);
  const withoutNoise = sorted.filter(
    (event, index) =>
      !isPrePublishPatch(event, index, sorted) &&
      !isReviewAuthorSync(event, index, sorted),
  );

  const windowMs = options.mergeWindowMinutes * 60_000;
  const merged: ActivityEvent[] = [];
  /** Open merge group per `author|document` → index into `merged`. */
  const open = new Map<string, number>();

  for (const event of withoutNoise) {
    const key = `${event.authorId}|${event.documentId}`;
    const openIndex = open.get(key);
    const target = openIndex === undefined ? undefined : merged[openIndex];

    if (
      target &&
      isMergeable(event) &&
      event.action === 'edit' &&
      !!target.direct === !!event.direct &&
      ms(event.at) - ms(target.lastAt) <= windowMs
    ) {
      merged[openIndex as number] = {
        ...target,
        lastAt:
          ms(event.lastAt) > ms(target.lastAt) ? event.lastAt : target.lastAt,
        mergedCount: target.mergedCount + event.mergedCount,
        changedFields: union(target.changedFields, event.changedFields),
        fieldChanges: mergeFieldChanges(
          target.fieldChanges,
          event.fieldChanges,
        ),
        transactionIds: union(target.transactionIds, event.transactionIds),
        touchedIds: union(target.touchedIds, event.touchedIds).sort(),
      };
      continue;
    }

    merged.push({ ...event });
    if (isMergeable(event)) {
      open.set(key, merged.length - 1);
    } else {
      // Any other action on the document closes the autosave group.
      open.delete(key);
    }
  }

  return merged;
}
