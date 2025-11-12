import { orderableDocumentListDeskItem } from '@sanity/orderable-document-list';
import {
  BookOpen,
  Calendar,
  File,
  FileText,
  Folder,
  FolderOpen,
  type LucideIcon,
  MessageSquareText,
  Settings2,
  Speaker,
  UserPen,
} from 'lucide-react';
import type {
  StructureBuilder,
  StructureResolverContext,
} from 'sanity/structure';

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
      createCollection({ S, context, type: 'page', title: 'Podstrony' }),
      S.divider(),
      S.listItem()
        .title('Blog')
        .icon(BookOpen)
        .child(
          S.list()
            .title('Blog')
            .items([
              createSingleTon({ S, type: 'blog', icon: FileText }),
              // Blog articles grouped by year
              S.listItem()
                .title('Wpisy na blogu')
                .icon(BookOpen)
                .child(async () => {
                  // Fetch all blog articles with their creation dates
                  const articles = await context
                    .getClient({ apiVersion: '2024-01-01' })
                    .fetch<
                      Array<{ _createdAt: string }>
                    >(`*[_type == "blog-article"] {_createdAt}`);

                  // Extract unique years and sort them in descending order
                  const years = [
                    ...new Set(
                      articles.map((article) =>
                        new Date(article._createdAt).getFullYear()
                      )
                    ),
                  ].sort((a, b) => b - a);

                  return S.list()
                    .title('Wpisy na blogu')
                    .items([
                      // "All Articles" option as first item
                      S.listItem()
                        .title('Wszystkie wpisy')
                        .icon(BookOpen)
                        .child(
                          S.documentList()
                            .title('Wszystkie wpisy')
                            .filter('_type == "blog-article"')
                            .defaultOrdering([
                              { field: '_createdAt', direction: 'desc' },
                            ])
                        ),
                      S.divider(),
                      // Dynamic list items for each year
                      ...years.map((year) =>
                        S.listItem()
                          .title(`${year}`)
                          .icon(Calendar)
                          .child(
                            S.documentList()
                              .title(`Wpisy z ${year}`)
                              .filter(
                                `_type == "blog-article" && dateTime(_createdAt) >= dateTime("${year}-01-01T00:00:00Z") && dateTime(_createdAt) < dateTime("${year + 1}-01-01T00:00:00Z")`
                              )
                              .defaultOrdering([
                                { field: '_createdAt', direction: 'desc' },
                              ])
                          )
                      ),
                    ]);
                }),
              createCollection({
                S,
                context,
                type: 'blog-category',
                orderable: true,
                title: 'Kategorie bloga',
              }),
            ])
        ),
      S.listItem()
        .title('Recenzje')
        .icon(MessageSquareText)
        .child(
          S.list()
            .title('Recenzje')
            .items([
              // Reviews grouped by author
              S.listItem()
                .title('Recenzje według autorów')
                .icon(MessageSquareText)
                .child(async () => {
                  // Fetch all review authors using the Sanity client
                  const authors = await context
                    .getClient({ apiVersion: '2024-01-01' })
                    .fetch<
                      Array<{ _id: string; name: string }>
                    >(`*[_type == "reviewAuthor"] | order(orderRank) {_id, name}`);

                  return S.list()
                    .title('Recenzje według autorów')
                    .items([
                      // "All Reviews" option as first item
                      S.listItem()
                        .title('Wszystkie recenzje')
                        .icon(MessageSquareText)
                        .child(
                          S.documentList()
                            .title('Wszystkie recenzje')
                            .filter('_type == "review"')
                            .defaultOrdering([
                              { field: '_createdAt', direction: 'desc' },
                            ])
                        ),
                      S.divider(),
                      // Dynamic list items for each author
                      ...authors.map((author) =>
                        S.listItem()
                          .title(author.name || 'Bez nazwy')
                          .icon(UserPen)
                          .child(
                            S.documentList()
                              .title(`${author.name} - Recenzje`)
                              .filter(
                                '_type == "review" && author._ref == $authorId'
                              )
                              .params({ authorId: author._id })
                              .defaultOrdering([
                                { field: '_createdAt', direction: 'desc' },
                              ])
                          )
                      ),
                    ]);
                }),
              createCollection({
                S,
                context,
                type: 'reviewAuthor',
                orderable: false,
                title: 'Lista autorów',
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
              // Products grouped by brand
              S.listItem()
                .title('Produkty według marek')
                .icon(Speaker)
                .child(async () => {
                  // Fetch all brands using the Sanity client
                  const brands = await context
                    .getClient({ apiVersion: '2024-01-01' })
                    .fetch<
                      Array<{ _id: string; name: string; logo?: any }>
                    >(`*[_type == "brand"] | order(orderRank) {_id, name, logo}`);

                  return S.list()
                    .title('Produkty według marek')
                    .items([
                      // "All Products" option as first item
                      S.listItem()
                        .title('Wszystkie produkty')
                        .icon(Speaker)
                        .child(
                          S.documentList()
                            .title('Wszystkie produkty')
                            .filter('_type == "product"')
                            .defaultOrdering([
                              { field: 'orderRank', direction: 'asc' },
                            ])
                        ),
                      S.divider(),
                      // Dynamic list items for each brand
                      ...brands.map((brand) =>
                        S.listItem()
                          .title(brand.name || 'Bez nazwy')
                          .icon(Folder)
                          .child(
                            S.documentList()
                              .title(`${brand.name} - Produkty`)
                              .filter(
                                '_type == "product" && brand._ref == $brandId'
                              )
                              .params({ brandId: brand._id })
                              .defaultOrdering([
                                { field: 'orderRank', direction: 'asc' },
                              ])
                          )
                      ),
                    ]);
                }),
              // CPO Products list
              S.listItem()
                .title('CPO')
                .icon(Speaker)
                .child(
                  S.documentList()
                    .title('Produkty CPO (Certyfikowany sprzęt używany)')
                    .filter('_type == "product" && isCPO == true')
                    .defaultOrdering([
                      { field: 'orderRank', direction: 'asc' },
                    ])
                ),
              createCollection({
                S,
                context,
                type: 'award',
                title: 'Lista nagród',
              }),
              S.divider(),
              createCollection({
                S,
                context,
                type: 'productCategoryParent',
                orderable: false,
                title: 'Kategorie nadrzędne',
              }),
              // Sub-categories grouped by parent
              S.listItem()
                .title('Kategorie podrzędne')
                .icon(Folder)
                .child(async () => {
                  // Fetch all parent categories
                  const parentCategories = await context
                    .getClient({ apiVersion: '2024-01-01' })
                    .fetch<
                      Array<{ _id: string; name: string }>
                    >(`*[_type == "productCategoryParent"] | order(orderRank) {_id, name}`);

                  return S.list()
                    .title('Kategorie podrzędne')
                    .items([
                      // "All Sub-categories" option
                      S.listItem()
                        .title('Wszystkie podkategorie')
                        .icon(Folder)
                        .child(
                          S.documentList()
                            .title('Wszystkie podkategorie')
                            .filter('_type == "productCategorySub"')
                            .defaultOrdering([
                              { field: 'orderRank', direction: 'asc' },
                            ])
                        ),
                      S.divider(),
                      // Dynamic list items for each parent category
                      ...parentCategories.map((parent) =>
                        S.listItem()
                          .title(parent.name || 'Bez nazwy')
                          .icon(FolderOpen)
                          .child(
                            S.documentList()
                              .title(`${parent.name} - Podkategorie`)
                              .filter(
                                '_type == "productCategorySub" && parentCategory._ref == $parentId'
                              )
                              .params({ parentId: parent._id })
                              .defaultOrdering([
                                { field: 'orderRank', direction: 'asc' },
                              ])
                          )
                      ),
                    ]);
                }),
            ])
        ),
      createCollection({
        S,
        context,
        type: 'store',
        orderable: false,
        title: 'Salony',
      }),
      createCollection({
        S,
        context,
        type: 'brand',
        orderable: true,
        title: 'Lista marek',
      }),
      createCollection({
        S,
        context,
        type: 'teamMember',
        title: 'Zespół',
      }),
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
