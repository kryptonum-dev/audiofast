import { useCallback, useRef } from 'react';
import type { DocumentActionComponent, DocumentActionsContext } from 'sanity';
import { useClient } from 'sanity';

import { fetchReviewAuthorCounts } from '../utils/review-author-counts';

async function syncReviewAuthorCounts(
  client: ReturnType<typeof useClient>,
  authorIds: string[],
) {
  const rows = await fetchReviewAuthorCounts(client, authorIds);

  if (!rows || rows.length === 0) return;

  const tx = client.transaction();
  for (const row of rows) {
    tx.patch(row._id, {
      set: {
        reviewCount: row.reviewCount ?? 0,
      },
    });
  }

  await tx.commit({ visibility: 'sync' });
}

/**
 * Wraps the default publish action of a review so the affected review
 * authors' `reviewCount` is recomputed after the publish. The UI stays exactly
 * the same as the default publish action.
 *
 * Products are no longer wrapped: their `denorm*` fields are owned by the
 * `denormalize-products` Sanity Function (`apps/functions`), which reacts to
 * every brand, sub-category and product change server-side.
 */
export function wrapPublishWithDenorm(
  originalPublishAction: DocumentActionComponent,
): DocumentActionComponent {
  const WrappedAction: DocumentActionComponent = (props) => {
    const { draft, published } = props;
    const client = useClient({ apiVersion: '2024-01-01' });

    // Get the original action result
    const originalResult = originalPublishAction(props);

    // Keep a ref to the latest onHandle so the async callback always calls the
    // most current version, even if a re-render has produced a new handler.
    const originalOnHandleRef = useRef(originalResult?.onHandle);
    originalOnHandleRef.current = originalResult?.onHandle;

    const wrappedOnHandle = useCallback(() => {
      if (!draft) {
        // No draft, just run original
        originalOnHandleRef.current?.();
        return;
      }

      const previousAuthorId = (published as any)?.author?._ref as
        string | undefined;
      const nextAuthorId = (draft as any)?.author?._ref as string | undefined;
      const affectedAuthorIds = [previousAuthorId, nextAuthorId].filter(
        Boolean,
      ) as string[];

      originalOnHandleRef.current?.();

      // Publish action is async in Studio internals; delay recount slightly.
      setTimeout(() => {
        void syncReviewAuthorCounts(client, affectedAuthorIds).catch(
          (error) => {
            console.error(
              'Failed to sync reviewAuthor counts after publish:',
              error,
            );
          },
        );
      }, 800);
    }, [client, draft, published]);

    // If the original action returns null, return as-is
    if (!originalResult) {
      return originalResult;
    }

    return {
      ...originalResult,
      onHandle: wrappedOnHandle,
    };
  };

  return WrappedAction;
}

/**
 * Helper to apply the review publish wrapper in the document.actions config.
 */
export function applyDenormToPublish(
  actions: DocumentActionComponent[],
  context: DocumentActionsContext,
): DocumentActionComponent[] {
  if (context.schemaType !== 'review') {
    return actions;
  }

  return actions.map((action) => {
    // Wrap the publish action
    if (action.action === 'publish') {
      return wrapPublishWithDenorm(action);
    }
    return action;
  });
}
