import { Children, isValidElement, type ReactNode } from 'react';

/**
 * Pure core of the draft-only PageBuilder reorder (ported from lsse-www /
 * Najbar). Kept free of `next-sanity/hooks` so it is unit-testable and so the
 * hook stays behind the `OptimisticBlocks` split boundary.
 */

/** The authored block arrays a page document can own. Audiofast has one. */
export type AuthoredBlockField = 'pageBuilder';

export type AuthoredBlocks = Partial<
  Record<AuthoredBlockField, ReadonlyArray<{ _key: string }> | null>
>;

/**
 * Reducer for `useOptimistic`: the next block order as bare `_key`s.
 *
 * State is the key order, never ReactNodes: one drag emits several
 * `rebased.local` events, so the reducer re-reduces its own output, and nodes
 * pushed through `Children.toArray()` on every pass get their keys re-prefixed
 * (`abc` → `.$abc` → `.$.$abc`) until every block vanishes (Najbar `f22cda4`).
 * `action.id` arrives normalised to the published id, which is what the
 * routed queries return under the drafts perspective.
 */
export function getOptimisticBlockOrder(
  state: string[] | null,
  action: { id: string; document: AuthoredBlocks },
  documentId: string,
  fieldName: AuthoredBlockField,
): string[] | null {
  if (action.id !== documentId) return state;
  const blocks = action.document[fieldName];
  return blocks ? blocks.map((block) => block._key) : state;
}

/**
 * Re-orders the server-rendered children to match `order`.
 *
 * Children are read with `Children.forEach`, which hands back the raw
 * `child.key` exactly as the server rendered it (`toArray()` would mangle it).
 * Keys in `order` with no rendered child (a block the projection or renderer
 * dropped) are skipped. When fewer children match than are rendered, the
 * event is sparse: keep the server order rather than remove visible sections
 * (Najbar `5bc5609`).
 */
export function reorderBlockChildren(
  children: ReactNode,
  order: string[] | null,
): ReactNode {
  if (!order) return children;

  const byKey = new Map<string, ReactNode>();
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.key !== null) {
      byKey.set(child.key, child);
    }
  });

  const reordered = order
    .map((key) => byKey.get(key))
    .filter((child) => child !== undefined);

  return reordered.length < Children.count(children) ? children : reordered;
}
