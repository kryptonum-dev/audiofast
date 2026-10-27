'use client';

import type { SanityDocument } from 'next-sanity';
// `next-sanity/hooks` is the ONLY legal import path for this hook. Importing
// `@sanity/visual-editing` directly creates a second copy of the actor
// singletons, and the overlay silently stops talking to the Studio.
import { useOptimistic } from 'next-sanity/hooks';
import type { ReactNode } from 'react';

import {
  type AuthoredBlockField,
  type AuthoredBlocks,
  getOptimisticBlockOrder,
  reorderBlockChildren,
} from '@/src/global/sanity/optimistic-order';

type PageBuilderParent = SanityDocument & AuthoredBlocks;

/**
 * Draft-only optimistic block sorting.
 *
 * When an editor drags a block in Presentation, the optimistic mutator
 * dispatches the patched draft here BEFORE the write round-trips the Content
 * Lake, so the server-rendered blocks move under the cursor instead of
 * snapping back until the next refresh. Outside Presentation the hook is
 * inert and the children render in server order.
 */
export default function OptimisticReorder({
  documentId,
  fieldName,
  children,
}: {
  documentId: string;
  fieldName: AuthoredBlockField;
  children: ReactNode;
}) {
  const order = useOptimistic<string[] | null, PageBuilderParent>(
    null,
    (state, action) =>
      getOptimisticBlockOrder(state, action, documentId, fieldName),
  );

  return reorderBlockChildren(children, order);
}
