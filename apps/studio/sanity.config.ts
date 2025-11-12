import { assist } from '@sanity/assist';
import { embeddingsIndexDashboard } from '@sanity/embeddings-index-ui';
import { visionTool } from '@sanity/vision';
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { media } from 'sanity-plugin-media';

import { Logo } from './components/logo';
import type { SingletonType } from './schemaTypes';
import { schemaTypes, singletonActions } from './schemaTypes';
import { singletons } from './schemaTypes/documents';
import { structure } from './structure';
import { createPageTemplate } from './utils/helper';

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? '';
const dataset = process.env.SANITY_STUDIO_DATASET;
const title = process.env.SANITY_STUDIO_TITLE;

export default defineConfig({
  name: 'default',
  title: title ?? 'Audiofast Studio',
  projectId: projectId,
  icon: Logo,
  dataset: dataset ?? 'production',
  plugins: [
    assist(),
    structureTool({
      structure,
    }),
    embeddingsIndexDashboard(),
    visionTool(),
    media(),
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
          ({ action }) => action && singletonActions.has(action)
        );
      }

      // For socialMedia - allow only viewing, deleting and custom actions
      if (context.schemaType === 'socialMedia') {
        return input.filter(({ action }) => {
          if (!action) return true;
          return action === 'publish' || action === 'discardChanges';
        });
      }

      // For all other types
      return input;
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
