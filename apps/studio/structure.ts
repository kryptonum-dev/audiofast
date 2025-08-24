import { orderableDocumentListDeskItem } from '@sanity/orderable-document-list';
import {
  Award,
  BookOpen,
  File,
  FileIcon,
  type LucideIcon,
  Settings2,
  Speaker,
  Star,
  Store,
  TableIcon,
} from 'lucide-react';
import type {
  StructureBuilder,
  StructureResolverContext,
} from 'sanity/structure';

import { UnifiedFeaturesManager } from './components/UnifiedFeaturesManager';
import type { SchemaType, SingletonType } from './schemaTypes';
import { schemaTypes } from './schemaTypes';
import { getTitleCase } from './utils/helper';

type CreateSingleTon = {
  S: StructureBuilder;
  type: SingletonType;
  title?: string;
  icon?: LucideIcon;
};

/**
 * Enhanced singleton creator that automatically resolves title and icon from schema definitions
 * Just pass the schema type name and it will handle the rest
 */
const createSingleTon = ({ S, type, title, icon }: CreateSingleTon) => {
  const schema = schemaTypes.find((item) => item.name === type) as {
    title?: string;
    icon?: LucideIcon;
  };

  const resolvedTitle = title ?? schema?.title ?? getTitleCase(type);
  const resolvedIcon = icon ?? schema?.icon ?? File;

  return S.listItem()
    .title(resolvedTitle)
    .icon(resolvedIcon)
    .child(
      S.document().schemaType(type).documentId(type).views([S.view.form()]) // Only content view, no preview
    );
};

type CreateCollection = {
  S: StructureBuilder;
  context: StructureResolverContext;
  type: SchemaType;
  title?: string;
  icon?: LucideIcon;
  orderable?: boolean;
  id?: string;
};

/**
 * Enhanced collection creator with orderable support
 * Set orderable: true to enable drag & drop ordering
 * Only shows content view (no preview)
 */
const createCollection = ({
  S,
  context,
  type,
  title,
  icon,
  orderable = false,
  id,
}: CreateCollection) => {
  const schema = schemaTypes.find((item) => item.name === type) as {
    title?: string;
    icon?: LucideIcon;
  };

  const resolvedTitle = title ?? schema?.title ?? getTitleCase(type);
  const resolvedIcon = icon ?? schema?.icon ?? File;

  if (orderable) {
    return orderableDocumentListDeskItem({
      type,
      S,
      context,
      icon: resolvedIcon,
      title: resolvedTitle,
      id: id ?? type,
    });
  }

  return S.documentTypeListItem(type)
    .id(id ?? type)
    .title(resolvedTitle)
    .icon(resolvedIcon);
};

export const structure = (
  S: StructureBuilder,
  context: StructureResolverContext
) => {
  return S.list()
    .title('Content')
    .items([
      createSingleTon({ S, type: 'homePage' }),
      createCollection({ S, context, type: 'page' }),
      S.divider(),
      S.listItem()
        .title('Blog')
        .icon(BookOpen)
        .child(
          S.list()
            .title('Blog')
            .items([
              createSingleTon({ S, type: 'blog' }),
              createCollection({
                S,
                context,
                type: 'blog-article',
                orderable: false,
                title: 'Wpisy na blogu',
              }),
            ])
        ),
      S.listItem()
        .title('Recenzje')
        .icon(Star)
        .child(
          S.list()
            .title('Recenzje')
            .items([
              createSingleTon({ S, type: 'reviews' }),
              createCollection({
                S,
                context,
                type: 'review',
                orderable: false,
                title: 'Lista recenzji',
              }),
            ])
        ),
      S.listItem()
        .title('Produkty')
        .icon(Speaker)
        .child(
          S.list()
            .title('Produkty')
            .items([
              createSingleTon({ S, type: 'products' }),
              S.listItem()
                .title('Lista produktów')
                .icon(Speaker)
                .child(
                  S.documentList()
                    .title('Lista produktów')
                    .filter('_type == "product"')
                    .child((documentId) =>
                      S.document()
                        .documentId(documentId)
                        .schemaType('product')
                        .views([
                          S.view
                            .form()
                            .title('Zawartość')
                            .icon(() => '📂'),
                          S.view
                            .component(UnifiedFeaturesManager)
                            .title('Menedżer cech')
                            .icon(() => '🔍'),
                        ])
                    )
                ),
              createCollection({
                S,
                context,
                type: 'award',
                title: 'Lista nagród',
              }),
              S.divider(),
              createSingleTon({ S, type: 'productCategories' }),
              createCollection({
                S,
                context,
                type: 'productCategoryParent',
                orderable: true,
                title: 'Kategorie nadrzędne',
              }),
              createCollection({
                S,
                context,
                type: 'productCategorySub',
                orderable: true,
                title: 'Kategorie podrzędne',
              }),
            ])
        ),
      S.listItem()
        .title('Salony')
        .icon(Store)
        .child(
          S.list()
            .title('Salony')
            .items([
              createSingleTon({ S, type: 'stores' }),
              createCollection({
                S,
                context,
                type: 'store',
                orderable: true,
                title: 'Lista salonów',
              }),
            ])
        ),
      S.listItem()
        .title('Marki')
        .icon(Award)
        .child(
          S.list()
            .title('Marki')
            .items([
              createSingleTon({ S, type: 'brands' }),
              createCollection({
                S,
                context,
                type: 'brand',
                orderable: true,
                title: 'Lista marek',
              }),
            ])
        ),
      createCollection({ S, context, type: 'faq' }),
      S.divider(),
      S.listItem()
        .title('Konfiguracja strony')
        .icon(Settings2)
        .child(
          S.list()
            .title('Konfiguracja strony')
            .items([
              createSingleTon({ S, type: 'navbar' }),
              createSingleTon({ S, type: 'footer' }),
              createSingleTon({ S, type: 'settings' }),
              createCollection({ S, context, type: 'socialMedia' }),
              createSingleTon({ S, type: 'notFound' }),
              createSingleTon({ S, type: 'termsAndConditions' }),
              createSingleTon({ S, type: 'privacyPolicy' }),
              createSingleTon({ S, type: 'redirects' }),
            ])
        ),
    ]);
};
