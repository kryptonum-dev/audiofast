import { assist } from '@sanity/assist';
import { visionTool } from '@sanity/vision';
import { GitCompareArrows, Mail } from 'lucide-react';
import { defineConfig } from 'sanity';
import { presentationTool } from 'sanity/presentation';
import { structureTool } from 'sanity/structure';
import { media } from 'sanity-plugin-media';

import { applyDenormToPublish, UnpublishAction } from './actions';
import { Logo } from './components/logo';
import { OpenInPresentationAction } from './plugins/presentation-url';
import { ContextualToolMenu } from './presentation/contextual-tool-menu';
import { locations } from './presentation/locations';
import { mainDocuments } from './presentation/main-documents';
import {
  getPresentationUrl,
  isPresentationEnabled,
  PRESENTATION_ORIGINS,
} from './presentation/settings';
import type { SingletonType } from './schemaTypes';
import { schemaTypes, singletonActions } from './schemaTypes';
import { singletons } from './schemaTypes/documents';
import { defaultDocumentNode, structure } from './structure';
import ComparatorTool from './tools/comparator';
import NewsletterTool from './tools/newsletter';
import { createPageTemplate } from './utils/helper';

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? '';
const dataset = process.env.SANITY_STUDIO_DATASET;
const title = process.env.SANITY_STUDIO_TITLE;

// Hidden in the deployed Studio until editors are told about it
// (`presentation/settings.ts`). The web side stays deployed either way.
const presentationEnabled = isPresentationEnabled();
const presentationActions = presentationEnabled
  ? [OpenInPresentationAction]
  : [];

export default defineConfig({
  name: 'default',
  title: title ?? 'Audiofast Studio',
  projectId: projectId,
  icon: Logo,
  dataset: dataset ?? 'production',
  // The „Treść" / „Podgląd" tabs carry the open document across tools; the
  // menu itself is Sanity's own (`presentation/contextual-tool-menu.tsx`).
  // `@beta` API: re-check both tabs after every `sanity` bump. Rollback =
  // this line.
  ...(presentationEnabled && {
    studio: { components: { toolMenu: ContextualToolMenu } },
  }),
  plugins: [
    assist(),
    // Tool titles are plain constants inside `sanity` ("Structure",
    // "Presentation"), not i18n keys, so we name the tabs ourselves. The menu
    // above matches tool NAMES, never these titles. Structure stays first so
    // the Studio still opens on content.
    structureTool({
      title: 'Treść',
      structure,
      defaultDocumentNode,
    }),
    ...(presentationEnabled
      ? [
          presentationTool({
            title: 'Podgląd',
            previewUrl: {
              // A function, resolved only when the tool opens: a Studio built
              // without SANITY_STUDIO_PRESENTATION_URL still boots
              // (`presentation/settings.ts`).
              initial: getPresentationUrl,
              // `shareAccess` is the ONLY working "open draft preview in a tab"
              // path: the share flow mints a secret and runs a top-level enable
              // handshake, so the draft cookie is set unpartitioned. The plain
              // „Otwórz podgląd" action never routes through `enable`, and the
              // iframe leg's CHIPS-partitioned cookie is invisible to a new tab.
              // With `trailingSlash: true` on the web, the route answers at
              // `/api/draft-mode/enable/` (the slashless form costs one 308).
              previewMode: {
                enable: '/api/draft-mode/enable',
                shareAccess: true,
              },
            },
            // ⚠️ Each origin needs a Sanity CORS entry WITH credentials.
            allowOrigins: PRESENTATION_ORIGINS,
            resolve: { locations, mainDocuments },
          }),
        ]
      : []),
    visionTool(),
    media(),
  ],
  tools: (prev) => [
    ...prev,
    {
      name: 'newsletter',
      title: 'Newsletter',
      icon: Mail,
      component: NewsletterTool,
    },
    {
      name: 'comparator',
      title: 'Porównywarka',
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
        // „Otwórz w podglądzie" is appended LAST in both branches, so
        // Publish stays the primary button. It returns `null` (no item) for
        // singletons without a page (settings, navbar, footer, …).
        return [
          ...input.filter(
            ({ action }) => action && singletonActions.has(action),
          ),
          ...presentationActions,
        ];
      }

      // For socialMedia - allow only viewing, deleting and custom actions
      if (context.schemaType === 'socialMedia') {
        return input.filter(({ action }) => {
          if (!action) return true;
          return action === 'publish' || action === 'discardChanges';
        });
      }

      // Apply denorm publish wrapper for all other types
      let actions = applyDenormToPublish(input, context);

      // Document types that should always have unpublish action available
      // Always add our custom unpublish action for these types
      const typesWithUnpublish = ['product', 'brand', 'blog-category'];
      if (typesWithUnpublish.includes(context.schemaType)) {
        // Remove any existing unpublish action and add our custom one
        actions = actions.filter(
          (a) => a.action !== 'unpublish' && (a as any).name !== 'unpublish',
        );
        actions = [...actions, UnpublishAction];
      }

      // Appended last: the first action is the primary button (Publish).
      // Unrouted types get no item (the action returns `null`).
      return [...actions, ...presentationActions];
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
      if (type === 'structure' && schemaType === 'socialMedia') {
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
