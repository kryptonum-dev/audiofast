import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { BookAudio, Package, Settings, Table } from 'lucide-react';
import { defineArrayMember, defineField, defineType } from 'sanity';

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
      title: 'Podtytuł (opcjonalny)',
      type: 'string',
      description:
        'Opcjonalny krótki opis kategorii produktu (np. "Trójdrożny głośnik wolnostojący"). Jeśli nie zostanie wypełniony, sekcja nie będzie wyświetlana.',
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
      name: 'publishedDate',
      title: 'Nadpisz datę publikacji',
      type: 'datetime',
      description:
        'Niestandardowa data publikacji produktu. Jeśli nie jest ustawiona, używana jest data utworzenia dokumentu. Przydatne przy migracji treści z innych systemów.',
      group: GROUP.MAIN_CONTENT,
      options: {
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
      },
    }),
    defineField({
      name: 'previewImage',
      title: 'Zdjęcie główne produktu',
      type: 'image',
      description:
        'Główne zdjęcie produktu używane w kartach produktów, listingach i sekcji hero na stronie produktu. Zalecane: zdjęcie na białym/czystym tle.',
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) =>
        Rule.required().error('Zdjęcie główne produktu jest wymagane'),
    }),
    defineField({
      name: 'imageGallery',
      title: 'Galeria zdjęć (opcjonalna)',
      type: 'array',
      description:
        'Dodatkowe zdjęcia produktu wyświetlane w sekcji galerii na stronie produktu. Mogą zawierać różne tła, konteksty użycia, zbliżenia itp.',
      of: [{ type: 'image' }],
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: 'shortDescription',
      title: 'Krótki opis (opcjonalny)',
      optional: true,
      description:
        'Opcjonalny krótki opis produktu wyświetlany na górze strony. Jeśli nie zostanie wypełniony, sekcja opisu nie będzie wyświetlana.',
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
          title: 'Nagłówek szczegółów (opcjonalny)',
          description:
            'Opcjonalny nagłówek sekcji szczegółów produktu. Jeśli puste, zostanie użyte "O produkcie".',
          type: 'heading',
          optional: true,
        }),
        defineField({
          name: 'content',
          title: 'Treść szczegółów',
          type: 'array',
          description:
            'Szczegółowy opis produktu, specyfikacja i inne informacje. Dodaj bloki tekstowe, filmy YouTube/Vimeo lub linie poziome.',
          of: [
            { type: 'contentBlockText' },
            { type: 'contentBlockYoutube' },
            { type: 'contentBlockVimeo' },
            { type: 'contentBlockHorizontalLine' },
          ],
          options: {
            insertMenu: {
              filter: true,
              showIcons: true,
              views: [{ name: 'list' }],
            },
          },
        }),
      ],
      validation: (Rule) =>
        Rule.required().error('Szczegóły produktu są wymagane'),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'technicalData',
      title: 'Dane techniczne',
      type: 'object',
      description:
        '⚠️ Edytuj dane techniczne w zakładce "Dane techniczne" powyżej. Ta sekcja obsługuje zarówno produkty z jednym modelem, jak i produkty z wieloma wariantami.',
      icon: Table,
      group: GROUP.MAIN_CONTENT,
      // Technical data is edited in a dedicated view tab (not in main form)
      // The field is kept in schema for data structure but hidden from main form
      hidden: true,
      fields: [
        // Variants array (for multi-model products)
        defineField({
          name: 'variants',
          title: 'Warianty produktu',
          type: 'array',
          of: [{ type: 'string' }],
          description:
            'Nazwy wariantów produktu (np. "Alive", "Excite", "Euphoria"). Pozostaw puste dla produktów bez wariantów.',
        }),

        // Technical data groups (sections with optional titles)
        defineField({
          name: 'groups',
          title: 'Sekcje danych technicznych',
          type: 'array',
          description:
            'Sekcje z parametrami technicznymi (np. "Specyfikacja techniczna", "Specyfikacja audio")',
          of: [
            defineArrayMember({
              type: 'object',
              name: 'technicalDataGroup',
              title: 'Sekcja',
              fields: [
                defineField({
                  name: 'title',
                  title: 'Nazwa sekcji',
                  type: 'string',
                  description:
                    'Opcjonalnie - np. "Specyfikacja techniczna". Zostaw puste dla produktów bez sekcji.',
                }),
                defineField({
                  name: 'rows',
                  title: 'Parametry',
                  type: 'array',
                  of: [
                    defineArrayMember({
                      type: 'object',
                      name: 'technicalDataRow',
                      title: 'Parametr techniczny',
                      fields: [
                        defineField({
                          name: 'title',
                          title: 'Nazwa parametru',
                          type: 'string',
                          description:
                            'Nazwa specyfikacji (np. "Wzmocnienie", "Impedancja")',
                          validation: (Rule) => Rule.required(),
                        }),
                        defineField({
                          name: 'values',
                          title: 'Wartości',
                          type: 'array',
                          description:
                            'Wartości dla każdego wariantu (lub jedna wartość dla produktów bez wariantów)',
                          of: [
                            defineArrayMember({
                              type: 'object',
                              name: 'cellValue',
                              title: 'Wartość komórki',
                              fields: [
                                defineField({
                                  name: 'content',
                                  title: 'Zawartość',
                                  type: 'array',
                                  of: [
                                    defineArrayMember({
                                      type: 'block',
                                      styles: [
                                        { title: 'Normalny', value: 'normal' },
                                      ],
                                      lists: [
                                        {
                                          title: 'Wypunktowana',
                                          value: 'bullet',
                                        },
                                        {
                                          title: 'Numerowana',
                                          value: 'number',
                                        },
                                      ],
                                      marks: {
                                        decorators: [
                                          {
                                            title: 'Pogrubienie',
                                            value: 'strong',
                                          },
                                          { title: 'Kursywa', value: 'em' },
                                        ],
                                        annotations: [
                                          {
                                            name: 'link',
                                            type: 'object',
                                            title: 'Link',
                                            fields: [
                                              defineField({
                                                name: 'href',
                                                type: 'url',
                                                title: 'URL',
                                                validation: (Rule) =>
                                                  Rule.uri({
                                                    scheme: [
                                                      'http',
                                                      'https',
                                                      'mailto',
                                                      'tel',
                                                    ],
                                                  }),
                                              }),
                                              defineField({
                                                name: 'blank',
                                                type: 'boolean',
                                                title: 'Otwórz w nowej karcie',
                                                initialValue: true,
                                              }),
                                            ],
                                          },
                                        ],
                                      },
                                    }),
                                  ],
                                }),
                              ],
                              preview: {
                                select: {
                                  content: 'content',
                                },
                                prepare: ({ content }) => {
                                  const text =
                                    content?.[0]?.children?.[0]?.text ||
                                    'Pusta komórka';
                                  return {
                                    title:
                                      text.length > 50
                                        ? text.slice(0, 50) + '...'
                                        : text,
                                  };
                                },
                              },
                            }),
                          ],
                        }),
                      ],
                      preview: {
                        select: {
                          title: 'title',
                          values: 'values',
                        },
                        prepare: ({ title, values }) => {
                          const valueCount = values?.length || 0;
                          const firstValue =
                            values?.[0]?.content?.[0]?.children?.[0]?.text ||
                            '';
                          return {
                            title: title || 'Parametr',
                            subtitle:
                              valueCount > 1
                                ? `${valueCount} wariantów`
                                : firstValue || 'Brak wartości',
                            media: Settings,
                          };
                        },
                      },
                    }),
                  ],
                }),
              ],
              preview: {
                select: {
                  title: 'title',
                  rows: 'rows',
                },
                prepare: ({ title, rows }) => ({
                  title: title || 'Parametry (bez sekcji)',
                  subtitle: `${rows?.length || 0} parametrów`,
                  media: Table,
                }),
              },
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'availableInStores',
      title: 'Dostępny w salonach (opcjonalny)',
      type: 'array',
      description:
        'Opcjonalnie wybierz salony dla tego produktu. Jeśli puste, na stronie produktu wyświetlone zostaną salony przypisane do marki.',
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
      title: 'Powiązane produkty (opcjonalne)',
      type: 'array',
      description:
        'Wybierz powiązane produkty, które będą wyświetlane na stronie tego produktu. To pole jest automatycznie synchronizowane z pipeline cenowego Excel, ale można je również edytować ręcznie.',
      of: [
        {
          type: 'reference',
          to: [{ type: 'product' }],
          options: {
            filter: ({ document }) => {
              const currentId = document?._id;
              const selectedIds = Array.isArray(document?.relatedProducts)
                ? document.relatedProducts
                    .map((item: any) => item._ref)
                    .filter(Boolean)
                : [];
              return {
                filter: '_id != $currentId && !(_id in $selectedIds)',
                params: { currentId, selectedIds },
              };
            },
          },
        },
      ],
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
    ...getSEOFields({ exclude: ['hideFromList'] }),
  ],
  preview: {
    select: {
      name: 'name',
      brandName: 'brand.name',
      subtitle: 'subtitle',
      isArchived: 'isArchived',
      image: 'previewImage',
    },
    prepare: ({ name, brandName, subtitle, isArchived, image }) => ({
      title: brandName && name ? `${brandName} ${name}` : name || 'Produkt',
      media: image || Package,
      subtitle: `${subtitle || 'Produkt audio'}${isArchived ? ' (Archiwalny)' : ''}`,
    }),
  },
});
