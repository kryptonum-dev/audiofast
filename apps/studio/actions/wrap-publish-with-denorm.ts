import { useCallback, useState } from "react";
import type { DocumentActionComponent, DocumentActionsContext } from "sanity";
import { useClient } from "sanity";

import { computeDenormalizedFields } from "../utils/denormalize-product";
import { fetchReviewAuthorCounts } from "../utils/review-author-counts";

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

  await tx.commit({ visibility: "sync" });
}

/**
 * Wraps the default publish action to auto-sync denormalized fields before publishing.
 * The UI remains exactly the same as the default publish action.
 */
export function wrapPublishWithDenorm(
  originalPublishAction: DocumentActionComponent,
): DocumentActionComponent {
  const WrappedAction: DocumentActionComponent = (props) => {
    const { draft, published, id, type } = props;
    const client = useClient({ apiVersion: "2024-01-01" });
    const [isProcessing, setIsProcessing] = useState(false);

    // Get the original action result
    const originalResult = originalPublishAction(props);

    // If the original action returns null, return as-is
    if (!originalResult) {
      return originalResult;
    }

    const originalOnHandle = originalResult.onHandle;

    const wrappedOnHandle = useCallback(async () => {
      if (!draft) {
        // No draft, just run original
        originalOnHandle?.();
        return;
      }

      setIsProcessing(true);

      try {
        // Review publish flow: sync author counters after publish completes.
        if (type === "review") {
          const previousAuthorId = (published as any)?.author?._ref as
            | string
            | undefined;
          const nextAuthorId = (draft as any)?.author?._ref as
            | string
            | undefined;
          const affectedAuthorIds = [previousAuthorId, nextAuthorId].filter(
            Boolean,
          ) as string[];

          originalOnHandle?.();

          // Publish action is async in Studio internals; delay recount slightly.
          setTimeout(() => {
            void syncReviewAuthorCounts(client, affectedAuthorIds).catch((error) => {
              console.error("Failed to sync reviewAuthor counts after publish:", error);
            });
          }, 800);

          return;
        }

        if (type !== "product") {
          originalOnHandle?.();
          return;
        }

        // Step 1: Compute denormalized fields from draft
        const denormalized = await computeDenormalizedFields(
          client,
          draft as Parameters<typeof computeDenormalizedFields>[1],
        );

        // Step 2: Patch the draft with denormalized fields
        await client
          .patch(`drafts.${id}`)
          .set(denormalized)
          .commit({ visibility: "async" });

        // Step 3: Small delay to ensure patch is committed
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Step 4: Execute the original publish
        originalOnHandle?.();
      } catch (error) {
        console.error("Failed to denormalize before publish:", error);
        // Still try to publish even if denormalization fails
        originalOnHandle?.();
      } finally {
        setIsProcessing(false);
      }
    }, [client, draft, id, originalOnHandle, published, type]);

    return {
      ...originalResult,
      // Keep original label but show processing state
      label: isProcessing ? "Publishing..." : originalResult.label,
      disabled: isProcessing || originalResult.disabled,
      onHandle: wrappedOnHandle,
    };
  };

  return WrappedAction;
}

/**
 * Helper to apply denormalization wrapper to publish action in document.actions config
 */
export function applyDenormToPublish(
  actions: DocumentActionComponent[],
  context: DocumentActionsContext,
): DocumentActionComponent[] {
  // Wrap for product and review documents.
  if (!["product", "review"].includes(context.schemaType)) {
    return actions;
  }

  return actions.map((action) => {
    // Wrap the publish action
    if (action.action === "publish") {
      return wrapPublishWithDenorm(action);
    }
    return action;
  });
}

