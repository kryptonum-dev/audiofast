import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { MessageSquareText } from 'lucide-react';
import type { FieldDefinition } from 'sanity';
import { defineField, defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import {
  createRadioListLayout,
  parsePortableTextToString,
} from '../../../utils/helper';
import { customPortableText } from '../../portableText';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const review = defineType({
  name: 'review',
  title: 'Recenzja',
  type: 'document',
  icon: MessageSquareText,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Recenzja produktu audio, która zostanie opublikowana na stronie internetowej. Dodaj tytuł, opis i treść, aby utworzyć nową recenzję produktu.',
  fields: [
    orderRankField({ type: 'reviews' }),
    defineField({
      name: 'author',
      title: 'Autor recenzji',
      type: 'reference',
      description: 'Wybierz autora tej recenzji',
      to: [{ type: 'reviewAuthor' }],
      validation: (Rule) =>
        Rule.required().error('Autor recenzji jest wymagany'),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'destinationType',
      title: 'Typ recenzji',
      type: 'string',
      description:
        'Wybierz, gdzie ma prowadzić ta recenzja: na stronę z treścią, do pliku PDF lub na zewnętrzny link',
      group: GROUP.MAIN_CONTENT,
      options: createRadioListLayout([
        { title: '📄 Strona z treścią', value: 'page' },
        { title: '📎 Dokument PDF', value: 'pdf' },
        { title: '🔗 Link zewnętrzny', value: 'external' },
      ]),
      initialValue: 'page',
      validation: (Rule) => Rule.required().error('Typ recenzji jest wymagany'),
    }),
    defineField({
      name: 'publishedDate',
      title: 'Nadpisz datę publikacji',
      type: 'datetime',
      description:
        'Niestandardowa data publikacji recenzji. Jeśli nie jest ustawiona, używana jest data utworzenia dokumentu. Przydatne przy migracji treści z innych systemów.',
      group: GROUP.MAIN_CONTENT,
      options: {
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
      },
    }),
    ...(defineSlugForDocument({
      prefix: '/recenzje/',
      source: 'name',
      group: GROUP.MAIN_CONTENT,
    }).map((field) => {
      if (field.name === 'slug') {
        return {
          ...field,
          hidden: ({ document }: any) => document?.destinationType !== 'page',
          // Override validation to make slug optional for pdf/external types
          validation: (Rule: any) =>
            Rule.custom(async (value: any, context: any) => {
              const destinationType = context.document?.destinationType;

              // Slug is only required for 'page' type reviews
              if (destinationType !== 'page') {
                return true; // Not required for pdf/external
              }

              // For 'page' type, slug is required
              if (!value?.current) {
                return 'Slug jest wymagany dla recenzji typu "Strona z treścią"';
              }

              const prefix = '/recenzje/';

              // Check prefix
              if (!value.current.startsWith(prefix)) {
                return `Slug powinien zaczynać się od ${prefix}`;
              }

              // Check content after prefix
              const contentAfterPrefix = value.current
                .replace(prefix, '')
                .trim();
              if (!contentAfterPrefix || contentAfterPrefix === '/') {
                return `Slug musi zawierać treść po ${prefix}. Sam ukośnik nie wystarczy.`;
              }

              // Check trailing slash
              if (value.current !== '/' && !value.current.endsWith('/')) {
                return 'Slug musi kończyć się ukośnikiem (/)';
              }

              return true;
            }),
        };
      }
      return {
        ...field,
        hidden: ({ document }: any) => document?.destinationType !== 'page',
      };
    }) as FieldDefinition[]),
    customPortableText({
      name: 'title',
      title: 'Tytuł recenzji',
      description:
        'Główny tytuł recenzji wyświetlany jako nagłówek (może zawierać formatowanie)',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: [],
        decorators: ['strong'],
        annotations: ['customLink'],
      },
      validation: (Rule) =>
        Rule.required().error('Tytuł recenzji jest wymagany'),
    }),
    customPortableText({
      name: 'description',
      title: 'Opis recenzji',
      description:
        'Krótki opis recenzji wyświetlany w sekcji najnowszej publikacji oraz innych listingach.',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: ['bullet', 'number'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const destinationType = (context.document as any)?.destinationType;
          if (destinationType === 'page') {
            return true;
          }
          if (!value || !Array.isArray(value) || value.length === 0) {
            return 'Opis recenzji jest wymagany dla recenzji typu „Dokument PDF” oraz „Link zewnętrzny”';
          }
          return true;
        }),
    }),
    defineField({
      name: 'image',
      title: 'Obraz główny',
      type: 'image',
      description:
        'Główny obraz recenzji wyświetlany w sekcji najnowszej publikacji',
      group: GROUP.MAIN_CONTENT,
      options: {
        hotspot: true,
      },
      validation: (Rule) => Rule.required().error('Obraz główny jest wymagany'),
    }),
    defineField({
      name: 'overrideGallery',
      title: 'Nadpisz galerię zdjęć',
      type: 'boolean',
      description:
        'Włącz tę opcję, aby użyć niestandardowej galerii zdjęć dla tej recenzji zamiast galerii z powiązanego produktu. Jeśli wyłączone, zostanie użyta galeria produktu (jeśli istnieje powiązany produkt).',
      group: GROUP.MAIN_CONTENT,
      initialValue: false,
      hidden: ({ document }: any) => document?.destinationType !== 'page',
    }),
    defineField({
      name: 'imageGallery',
      title: 'Galeria zdjęć recenzji',
      type: 'array',
      description:
        'Dodaj zdjęcia do galerii recenzji (minimum 4 zdjęcia). Ta galeria nadpisze galerię produktu.',
      group: GROUP.MAIN_CONTENT,
      of: [{ type: 'image' }],
      hidden: ({ document }: any) =>
        document?.destinationType !== 'page' || !document?.overrideGallery,
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const destinationType = (context.document as any)?.destinationType;
          const overrideGallery = (context.document as any)?.overrideGallery;
          if (
            destinationType === 'page' &&
            overrideGallery === true &&
            (!value || !Array.isArray(value) || value.length < 4)
          ) {
            return 'Galeria musi zawierać minimum 4 zdjęcia gdy nadpisujesz galerię produktu';
          }
          return true;
        }),
    }),
    customPortableText({
      name: 'content',
      title: 'Treść recenzji',
      description:
        'Główna treść recenzji - tylko dla recenzji typu "Strona z treścią"',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal', 'h2', 'h3'],
        lists: ['bullet', 'number'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
      components: [
        'ptImage',
        'ptArrowList',
        'ptCircleNumberedList',
        'ptCtaSection',
        'ptTwoColumnTable',
        'ptFeaturedProducts',
        'ptQuote',
        'ptButton',
      ],
      optional: true,
      hidden: ({ document }: any) => document?.destinationType !== 'page',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const destinationType = (context.document as any)?.destinationType;
          if (
            destinationType === 'page' &&
            (!value || !Array.isArray(value) || value.length === 0)
          ) {
            return 'Treść jest wymagana dla recenzji typu "Strona z treścią"';
          }
          return true;
        }),
    }),
    defineField({
      name: 'pdfFile',
      title: 'Plik PDF',
      type: 'file',
      description:
        'Prześlij plik PDF z recenzją. Nazwa pliku będzie użyta w URL (np. test-produktu.pdf → /recenzje/pdf/test-produktu)',
      group: GROUP.MAIN_CONTENT,
      options: {
        accept: '.pdf',
      },
      hidden: ({ document }: any) => document?.destinationType !== 'pdf',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const destinationType = (context.document as any)?.destinationType;
          if (destinationType === 'pdf' && !value) {
            return 'Plik PDF jest wymagany dla recenzji typu "Dokument PDF"';
          }
          return true;
        }),
    }),
    defineField({
      name: 'externalUrl',
      title: 'Link zewnętrzny',
      type: 'url',
      description:
        'Wprowadź pełny adres URL do zewnętrznej recenzji (np. https://example.com/recenzja) - tylko dla recenzji typu "Link zewnętrzny"',
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }: any) => document?.destinationType !== 'external',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const destinationType = (context.document as any)?.destinationType;
          if (destinationType === 'external' && !value) {
            return 'Link zewnętrzny jest wymagany dla recenzji typu "Link zewnętrzny"';
          }
          if (
            destinationType === 'external' &&
            value &&
            !value.startsWith('http')
          ) {
            return 'Link zewnętrzny musi zaczynać się od http:// lub https://';
          }
          return true;
        }),
    }),
    {
      ...pageBuilderField,
      title: 'Niestandardowe sekcje',
      description:
        'Dodaj niestandardowe sekcje na końcu recenzji (opcjonalne).',
      hidden: ({ document }: any) => document?.destinationType !== 'page',
    },
    ...(getSEOFields().map((field) => ({
      ...field,
      hidden: ({ document }: any) => document?.destinationType !== 'page',
    })) as FieldDefinition[]),
  ],
  preview: {
    select: {
      titlePortable: 'title',
      content: 'content',
      description: 'description',
      image: 'image',
      authorName: 'author.name',
    },
    prepare: ({ titlePortable, content, description, image, authorName }) => {
      const titleText = parsePortableTextToString(titlePortable) || 'Recenzja';
      const contentText =
        parsePortableTextToString(description || content) || 'Recenzja produktu';

      return {
        title: titleText,
        media: image || MessageSquareText,
        subtitle: authorName ? `${authorName} • ${contentText}` : contentText,
      };
    },
  },
});
