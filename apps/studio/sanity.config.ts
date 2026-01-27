import { assist } from "@sanity/assist";
import { embeddingsIndexDashboard } from "@sanity/embeddings-index-ui";
import { visionTool } from "@sanity/vision";
import { GitCompareArrows, Mail } from "lucide-react";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
// import { bulkActionsTable } from 'sanity-plugin-bulk-actions-table';
import { media } from "sanity-plugin-media";

import { applyDenormToPublish, UnpublishAction } from "./actions";
import { Logo } from "./components/logo";
import type { SingletonType } from "./schemaTypes";
import { schemaTypes, singletonActions } from "./schemaTypes";
import { singletons } from "./schemaTypes/documents";
import { defaultDocumentNode, structure } from "./structure";
import ComparatorTool from "./tools/comparator";
import NewsletterTool from "./tools/newsletter";
import { createPageTemplate } from "./utils/helper";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? "";
const dataset = process.env.SANITY_STUDIO_DATASET;
const title = process.env.SANITY_STUDIO_TITLE;

export default defineConfig({
  name: "default",
  title: title ?? "Audiofast Studio",
  projectId: projectId,
  icon: Logo,
  dataset: dataset ?? "production",
  plugins: [
    assist(),
    structureTool({
      structure,
      defaultDocumentNode,
    }),
    // bulkActionsTable(),
    embeddingsIndexDashboard(),
    visionTool(),
    media(),
  ],
  tools: (prev) => [
    ...prev,
    {
      name: "newsletter",
      title: "Newsletter",
      icon: Mail,
      component: NewsletterTool,
    },
    {
      name: "comparator",
      title: "Porównywarka",
      icon: GitCompareArrows,
      component: ComparatorTool,
    },
  ],

  document: {
    actions: (input, context) => {
      // For singleton types
      if (
        singletons
          .map((singleton) => singleton.name)
          .includes(context.schemaType as SingletonType)
      ) {
        return input.filter(
          ({ action }) => action && singletonActions.has(action),
        );
      }

      // For socialMedia - allow only viewing, deleting and custom actions
      if (context.schemaType === "socialMedia") {
        return input.filter(({ action }) => {
          if (!action) return true;
          return action === "publish" || action === "discardChanges";
        });
      }

      // Apply denorm publish wrapper for all other types
      let actions = applyDenormToPublish(input, context);

      // Document types that should always have unpublish action available
      // Always add our custom unpublish action for these types
      const typesWithUnpublish = ["product", "brand", "blog-category"];
      if (typesWithUnpublish.includes(context.schemaType)) {
        // Remove any existing unpublish action and add our custom one
        actions = actions.filter(
          (a) => a.action !== "unpublish" && (a as any).name !== "unpublish",
        );
        actions = [...actions, UnpublishAction];
      }

      return actions;
    },
    newDocumentOptions: (prev, { creationContext }) => {
      const { type, schemaType } = creationContext;

      // Prevent creation of singleton documents
      if (
        singletons
          .map((singleton) => singleton.name)
          .includes(schemaType as SingletonType)
      ) {
        return [];
      }

      // Prevent creation of socialMedia documents from structure
      if (type === "structure" && schemaType === "socialMedia") {
        return [];
      }

      return prev;
    },
  },
  schema: {
    types: schemaTypes,
    templates: createPageTemplate(),
  },
});
