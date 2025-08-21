import { DocumentIcon } from '@sanity/icons';
import { orderableDocumentListDeskItem } from '@sanity/orderable-document-list';
import {
  AlertTriangle,
  Book,
  BookOpen,
  CogIcon,
  File,
  FileArchive,
  HomeIcon,
  Link,
  Lock,
  type LucideIcon,
  MessageCircleQuestion,
  PanelBottom,
  PanelTop,
  SearchIcon,
  Settings2,
  ShieldIcon,
  Users2Icon,
} from 'lucide-react';
import type {
  StructureBuilder,
  StructureResolverContext,
} from 'sanity/structure';

import type { SchemaType, SingletonType } from './schemaTypes';
import { getTitleCase } from './utils/helper';

type Base<T = SchemaType> = {
  id?: string;
  type: T;
  preview?: boolean;
  title?: string;
  icon?: LucideIcon;
};

type CreateSingleTon = {
  S: StructureBuilder;
} & Base<SingletonType>;

const createSingleTon = ({ S, type, title, icon }: CreateSingleTon) => {
  const newTitle = title ?? getTitleCase(type);
  return S.listItem()
    .title(newTitle)
    .icon(icon ?? File)
    .child(S.document().schemaType(type).documentId(type));
};

type CreateList = {
  S: StructureBuilder;
} & Base;

// This function creates a list item for a type. It takes a StructureBuilder instance (S),
// a type, an icon, and a title as parameters. It generates a title for the type if not provided,
// and uses a default icon if not provided. It then returns a list item with the generated or
// provided title and icon.

const createList = ({ S, type, icon, title, id }: CreateList) => {
  const newTitle = title ?? getTitleCase(type);
  return S.documentTypeListItem(type)
    .id(id ?? type)
    .title(newTitle)
    .icon(icon ?? File);
};

type CreateIndexList = {
  S: StructureBuilder;
  list: Base;
  index: Base<SingletonType>;
  context: StructureResolverContext;
  fullTitle?: string;
};

const createIndexListWithOrderableItems = ({
  S,
  index,
  fullTitle,
  list,
  context,
}: CreateIndexList) => {
  const indexTitle = index.title ?? getTitleCase(index.type);
  const listTitle = list.title ?? getTitleCase(list.type);
  return S.listItem()
    .title(fullTitle ?? listTitle)
    .icon(index.icon ?? File)
    .child(
      S.list()
        .title(indexTitle)
        .items([
          S.listItem()
            .title(indexTitle)
            .icon(index.icon ?? File)
            .child(
              S.document()
                .views([S.view.form()])
                .schemaType(index.type)
                .documentId(index.type)
            ),
          orderableDocumentListDeskItem({
            type: list.type,
            S,
            context,
            icon: list.icon ?? File,
            title: `${listTitle}`,
          }),
        ])
    );
};

export const structure = (
  S: StructureBuilder,
  context: StructureResolverContext
) => {
  return S.list()
    .title('Content')
    .items([
      createSingleTon({
        S,
        type: 'homePage',
        title: 'Strona główna',
        icon: HomeIcon,
      }),
      createList({ S, type: 'page', title: 'Podstrony', icon: Book }),
      S.divider(),
      createIndexListWithOrderableItems({
        S,
        index: { type: 'blog', title: 'Strona Bloga', icon: Book },
        list: { type: 'blog-article', title: 'Wpisy na blogu', icon: BookOpen },
        fullTitle: 'Blog',
        context,
      }),
      S.divider(),
      createList({
        S,
        type: 'faq',
        title: 'Elementy FAQ',
        icon: MessageCircleQuestion,
      }),
      S.divider(),
      S.listItem()
        .title('Konfiguracja strony')
        .icon(Settings2)
        .child(
          S.list()
            .title('Konfiguracja strony')
            .items([
              createSingleTon({
                S,
                type: 'navbar',
                title: 'Nawigacja',
                icon: PanelTop,
              }),
              createSingleTon({
                S,
                type: 'footer',
                title: 'Stopka',
                icon: PanelBottom,
              }),
              createSingleTon({
                S,
                type: 'settings',
                title: 'Ustawienia globalne',
                icon: CogIcon,
              }),
              createList({
                S,
                type: 'socialMedia',
                title: 'Media społecznościowe',
                icon: Users2Icon,
              }),
              createSingleTon({
                S,
                type: 'notFound',
                title: 'Nie znaleziono strony (404)',
                icon: AlertTriangle,
              }),

              createSingleTon({
                S,
                type: 'termsAndConditions',
                title: 'Regulamin',
                icon: FileArchive,
              }),
              createSingleTon({
                S,
                type: 'privacyPolicy',
                title: 'Polityka prywatności',
                icon: Lock,
              }),
              createSingleTon({
                S,
                type: 'redirects',
                title: 'Przekierowania',
                icon: Link,
              }),
            ])
        ),
    ]);
};
