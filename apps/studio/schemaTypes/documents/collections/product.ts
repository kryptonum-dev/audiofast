import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { BookAudio, Package, Settings } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { customPortableText } from '../../definitions/portable-text';
import { getSEOFields } from '../../shared/seo';

export const product = defineType({
  name: 'product',
  title: 'Produkt audio',
  type: 'document',
  icon: BookAudio,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Produkt audio, który zostanie opublikowany na stronie internetowej. Dodaj tytuł, opis i specyfikację, aby utworzyć nowy produkt.',
  fields: [
    orderRankField({ type: 'products' }),

    defineField({
      name: 'subtitle',
      title: 'Podtytuł',
      type: 'string',
      description:
        'Krótki opis kategorii produktu (np. "Trójdrożny głośnik wolnostojący").',
      validation: (Rule) => Rule.required().error('Podtytuł jest wymagany'),
      group: GROUP.MAIN_CONTENT,
    }),
    ...defineSlugForDocument({
      prefix: '/produkty/',
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'price',
      title: 'Cena',
      type: 'number',
      description: 'Cena produktu.',
      initialValue: 0,
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'imageGallery',
      title: 'Galeria zdjęć',
      type: 'array',
      description:
        'Zdjęcia produktu. Pierwsze zdjęcie będzie głównym zdjęciem produktu.',
      of: [{ type: 'image' }],
      validation: (Rule) =>
        Rule.min(1).error('Produkt musi mieć co najmniej jedno zdjęcie'),
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: 'shortDescription',
      title: 'Krótki opis',
      description: 'Krótki opis produktu wyświetlany na górze strony.',
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'isArchived',
      title: 'Produkt archiwalny',
      type: 'boolean',
      description:
        'Oznacz jako archiwalne, jeśli producent już nie produkuje tego produktu, ale Audiofast nadal ma go w sprzedaży.',
      initialValue: false,
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'brand',
      title: 'Marka',
      type: 'reference',
      description: 'Wybierz markę tego produktu.',
      to: [{ type: 'brand' }],
      validation: (Rule) => Rule.required().error('Marka jest wymagana'),
      group: GROUP.MAIN_CONTENT,
    }),

    defineField({
      name: 'awards',
      title: 'Nagrody',
      type: 'array',
      description: 'Wybierz nagrody i wyróżnienia przyznane temu produktowi.',
      of: [
        {
          type: 'reference',
          to: [{ type: 'award' }],
          options: {
            filter: ({ document }) => {
              const selectedIds = Array.isArray(document?.awards)
                ? document.awards.map((item: any) => item._ref).filter(Boolean)
                : [];
              return {
                filter: '!(_id in $selectedIds)',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'details',
      title: 'Szczegóły produktu',
      type: 'object',
      description: 'Szczegółowy opis produktu z nagłówkiem i treścią.',
      fields: [
        customPortableText({
          name: 'heading',
          title: 'Nagłówek szczegółów',
          description: 'Nagłówek sekcji szczegółów produktu.',
          type: 'heading',
        }),
        customPortableText({
          name: 'content',
          title: 'Treść szczegółów',
          description:
            'Szczegółowy opis produktu, specyfikacja i inne informacje.',
        }),
      ],
      validation: (Rule) =>
        Rule.required().error('Szczegóły produktu są wymagane'),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'duplicateGalleryInDetails',
      title: 'Duplikuj galerię w szczegółach',
      type: 'boolean',
      description: 'Czy wyświetlić galerię zdjęć ponownie w sekcji szczegółów?',
      initialValue: false,
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'technicalData',
      title: 'Dane techniczne',
      type: 'array',
      description: 'Specyfikacja techniczna produktu.',
      of: [
        {
          type: 'object',
          name: 'technicalDataItem',
          title: 'Parametr techniczny',
          fields: [
            defineField({
              name: 'title',
              title: 'Nazwa parametru',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'value',
              title: 'Wartość',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: {
              title: 'title',
              value: 'value',
            },
            prepare: ({ title, value }) => ({
              title: title || 'Parametr',
              subtitle: value || 'Brak wartości',
              media: Settings,
            }),
          },
        },
      ],
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'availableInStores',
      title: 'Dostępny w salonach',
      type: 'array',
      description: 'Wybierz salony, w których dostępny jest ten produkt.',
      of: [
        {
          type: 'reference',
          to: [{ type: 'store' }],
          options: {
            filter: ({ document }) => {
              const selectedIds = Array.isArray(document?.availableInStores)
                ? document.availableInStores
                    .map((item: any) => item._ref)
                    .filter(Boolean)
                : [];
              return {
                filter: '!(_id in $selectedIds)',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.min(1).error(
          'Produkt musi być dostępny w co najmniej jednym salonie'
        ),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'reviews',
      title: 'Recenzje',
      type: 'array',
      description: 'Wybierz recenzje tego produktu (minimum 4, maksimum 10).',
      of: [
        {
          type: 'reference',
          to: [{ type: 'review' }],
          options: {
            filter: ({ document }) => {
              const selectedIds = Array.isArray(document?.reviews)
                ? document.reviews.map((item: any) => item._ref).filter(Boolean)
                : [];
              return {
                filter: '!(_id in $selectedIds)',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.min(4).max(10).error('Produkt musi mieć między 4 a 10 recenzji'),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'relatedProducts',
      title: 'Powiązane produkty',
      type: 'array',
      description: 'Wybierz powiązane produkty (minimum 4, maksimum 10).',
      of: [
        {
          type: 'reference',
          to: [{ type: 'product' }],
          options: {
            filter: ({ document }) => {
              const selectedIds = Array.isArray(document?.relatedProducts)
                ? document.relatedProducts
                    .map((item: any) => item._ref)
                    .filter(Boolean)
                : [];
              const currentProductId = document?._id?.replace(/^drafts\./, '');
              const excludedIds = currentProductId
                ? [...selectedIds, currentProductId]
                : selectedIds;
              return {
                filter: '!(_id in $excludedIds)',
                params: { excludedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.min(4)
          .max(10)
          .error('Musi być między 4 a 10 powiązanych produktów'),
      group: GROUP.MAIN_CONTENT,
    }),

    defineField({
      name: 'pageBuilder',
      title: 'Niestandardowe sekcje',
      type: 'pageBuilder',
      description:
        'Dodaj niestandardowe sekcje na końcu strony produktu (opcjonalne).',
      group: GROUP.MAIN_CONTENT,
    }),
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: 'name',
      brandName: 'brand.name',
      subtitle: 'subtitle',
      isArchived: 'isArchived',
      image: 'imageGallery.[0]',
    },
    prepare: ({ name, brandName, subtitle, isArchived, image }) => ({
      title: brandName && name ? `${brandName} ${name}` : name || 'Produkt',
      media: image || Package,
      subtitle: `${subtitle || 'Produkt audio'}${isArchived ? ' (Archiwalny)' : ''}`,
    }),
  },
});
