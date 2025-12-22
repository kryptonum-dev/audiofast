import type { DocumentActionComponent, DocumentActionsContext } from "sanity";
import { useClient } from "sanity";
import { useCallback, useState } from "react";

import { computeDenormalizedFields } from "../utils/denormalize-product";

/**
 * Wraps the default publish action to auto-sync denormalized fields before publishing.
 * The UI remains exactly the same as the default publish action.
 */
export function wrapPublishWithDenorm(
  originalPublishAction: DocumentActionComponent,
): DocumentActionComponent {
  const WrappedAction: DocumentActionComponent = (props) => {
    const { draft, id, type } = props;
    const client = useClient({ apiVersion: "2024-01-01" });
    const [isProcessing, setIsProcessing] = useState(false);

    // Get the original action result
    const originalResult = originalPublishAction(props);

    // If the original action returns null or it's not a product, return as-is
    if (!originalResult || type !== "product") {
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
    }, [client, id, draft, originalOnHandle]);

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
  // Only wrap for product documents
  if (context.schemaType !== "product") {
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

