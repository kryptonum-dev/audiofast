import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { BookAudio, Package, Settings } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { CustomFilterValueInput } from '../../../components/custom-filter-value-input';
import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { customPortableText } from '../../portableText';
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
      name: 'basePriceCents',
      title: 'Cena bazowa (grosze)',
      type: 'number',
      description:
        'Automatycznie synchronizowana z danych cenowych z Excela. To pole jest tylko do odczytu i jest aktualizowane przez pipeline cenowy. 1 PLN = 100 groszy.',
      readOnly: false,
      validation: (Rule) => Rule.integer().min(0),
      // hidden: ({ document }) => !document?.basePriceCents,
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'lastPricingSync',
      title: 'Ostatnia synchronizacja cen',
      type: 'datetime',
      description:
        'Znacznik czasu ostatniej aktualizacji ceny z Excela. Aktualizowany automatycznie.',
      readOnly: false,
      // hidden: ({ document }) => !document?.lastPricingSync,
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'previewImage',
      title: 'Zdjęcie podglądowe (opcjonalne)',
      type: 'image',
      description:
        'Zdjęcie produktu na białym/czystym tle używane w kartach produktów i listingach. To zdjęcie NIE jest częścią galerii na stronie produktu. Jeśli nie ustawisz tego pola, pierwsze zdjęcie z galerii zostanie użyte.',
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'imageGallery',
      title: 'Galeria zdjęć',
      type: 'array',
      description:
        'Zdjęcia produktu dla galerii na stronie produktu. Mogą zawierać różne tła, konteksty użycia, zbliżenia itp.',
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
      name: 'isCPO',
      title: 'Certyfikowany sprzęt używany (CPO)',
      type: 'boolean',
      description: 'Oznacz, jeśli produkt jest objęty w programie CPO.',
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
      name: 'categories',
      title: 'Kategorie',
      type: 'array',
      description:
        'Wybierz kategorie, do których należy ten produkt. Produkt może należeć do wielu kategorii.',
      of: [
        {
          type: 'reference',
          to: [{ type: 'productCategorySub' }],
          options: {
            filter: ({ document }) => {
              const selectedIds = Array.isArray(document?.categories)
                ? document.categories
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
        Rule.required().error(
          'Produkt musi należeć do co najmniej jednej kategorii'
        ),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'customFilterValues',
      title: 'Wartości niestandardowych filtrów',
      type: 'array',
      description:
        'Podaj wartości dla filtrów zdefiniowanych w wybranych kategoriach. Filtry są automatycznie pobierane z przypisanych kategorii.',
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }) =>
        !document?.categories ||
        !Array.isArray(document.categories) ||
        document.categories.length === 0,
      components: {
        input: CustomFilterValueInput,
      },
      of: [
        defineField({
          type: 'object',
          name: 'filterValue',
          title: 'Wartość filtra',
          fields: [
            defineField({
              name: 'filterName',
              title: 'Nazwa filtra',
              type: 'string',
              description:
                'Nazwa filtra z kategorii (np. "Długość kabla", "Moc wzmacniacza")',
              validation: (Rule) =>
                Rule.required().error('Nazwa filtra jest wymagana'),
            }),
            defineField({
              name: 'value',
              title: 'Wartość',
              type: 'string',
              description: 'Wartość dla tego filtra (np. "2m", "100W", "8Ω")',
              validation: (Rule) =>
                Rule.required().error('Wartość filtra jest wymagana'),
            }),
          ],
          preview: {
            select: {
              filterName: 'filterName',
              value: 'value',
            },
            prepare: ({ filterName, value }) => ({
              title: filterName || 'Filtr',
              subtitle: value || 'Brak wartości',
              media: Settings,
            }),
          },
        }),
      ],
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
          include: {
            styles: ['normal', 'h3'],
            lists: ['bullet', 'number'],
            decorators: ['strong', 'em'],
            annotations: ['customLink'],
          },
          components: ['ptMinimalImage', 'ptHeading', 'ptYoutubeVideo'],
        }),
      ],
      validation: (Rule) =>
        Rule.required().error('Szczegóły produktu są wymagane'),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'technicalData',
      title: 'Dane techniczne (opcjonalne)',
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
              description: 'Zawartość pierwszej kolumny',
              validation: (Rule) => Rule.required(),
            }),
            customPortableText({
              name: 'value',
              title: 'Wartość',
              description: 'Zawartość drugiej kolumny (z formatowaniem)',
              include: {
                styles: ['normal'],
                lists: [],
                decorators: ['strong', 'em'],
                annotations: ['customLink'],
              },
            }),
          ],
          preview: {
            select: {
              title: 'title',
              value: 'value',
            },
            prepare: ({ title, value }) => {
              const valueText =
                value?.[0]?.children?.[0]?.text || 'Brak wartości';
              return {
                title: title || 'Parametr',
                subtitle: valueText,
                media: Settings,
              };
            },
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
      description:
        'Wybierz recenzje tego produktu (maksymalnie 10, opcjonalne).',
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
        Rule.max(10).error('Produkt może mieć maksymalnie 10 recenzji'),
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
