import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { BookAudio, Package, Settings, X } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../utils/define-slug-for-document';
import { getSEOFields } from '../../shared/seo';

// Reusable object definition for a product feature. This mirrors the inline
// object used in the legacy `features` array so we can reference the same shape
// inside the new `featureConfig` without creating a new global schema type.
const productFeatureObject = {
  type: 'object' as const,
  name: 'productFeature',
  title: 'Cecha produktu',
  fields: [
    defineField({
      name: 'featureName',
      title: 'Nazwa cechy',
      type: 'string',
      description: 'Nazwa cechy (np. "Model", "Długość", "Kolor")',
      validation: (Rule) => Rule.required().error('Nazwa cechy jest wymagana'),
    }),
    defineField({
      name: 'options',
      title: 'Opcje cechy',
      type: 'array',
      description: 'Lista dostępnych opcji. Pierwsza opcja jest domyślna.',
      validation: (Rule) =>
        Rule.required().min(1).error('Cecha musi mieć co najmniej jedną opcję'),
      of: [
        {
          type: 'object',
          name: 'featureOption',
          title: 'Opcja cechy',
          fields: [
            defineField({
              name: 'label',
              title: 'Nazwa opcji',
              type: 'string',
              description:
                'Nazwa wyświetlana dla tej opcji (np. "Euphoria", "1.5m", "Złoty")',
              validation: (Rule) =>
                Rule.required().error('Nazwa opcji jest wymagana'),
            }),
            defineField({
              name: 'secondOption',
              title: 'Zagnieżdżona opcja (opcjonalnie)',
              type: 'object',
              description:
                'Dodatkowa konfiguracja dla tej opcji, np. długość własna z zakresem lub podrzędne wybory.',
              fields: [
                defineField({
                  name: 'enabled',
                  title: 'Włącz drugą opcję',
                  type: 'boolean',
                  initialValue: false,
                }),
                defineField({
                  name: 'kind',
                  title: 'Rodzaj',
                  type: 'string',
                  options: {
                    list: [
                      { title: 'Liczbowa (np. długość)', value: 'numeric' },
                      { title: 'Wybór (lista opcji)', value: 'choice' },
                    ],
                    layout: 'radio',
                  },
                }),
                defineField({
                  name: 'numeric',
                  title: 'Konfiguracja liczbowa',
                  type: 'object',
                  fields: [
                    defineField({
                      name: 'label',
                      title: 'Etykieta pola',
                      description:
                        'Tekst wyświetlany przy polu (np. "Długość")',
                      type: 'string',
                    }),
                    defineField({
                      name: 'unit',
                      title: 'Jednostka',
                      type: 'string',
                    }),
                    defineField({
                      name: 'min',
                      title: 'Minimalna wartość',
                      type: 'number',
                    }),
                    defineField({
                      name: 'max',
                      title: 'Maksymalna wartość',
                      type: 'number',
                    }),
                    defineField({
                      name: 'step',
                      title: 'Krok',
                      type: 'number',
                    }),
                    defineField({
                      name: 'perUnitPrice',
                      title: 'Cena za jednostkę',
                      type: 'number',
                    }),
                  ],
                  hidden: ({ parent }) => parent?.kind !== 'numeric',
                }),
                defineField({
                  name: 'choices',
                  title: 'Podrzędne opcje',
                  type: 'array',
                  of: [
                    {
                      type: 'object',
                      name: 'secondChoice',
                      fields: [
                        defineField({
                          name: 'label',
                          title: 'Nazwa',
                          type: 'string',
                        }),
                        defineField({
                          name: 'value',
                          title: 'Wartość',
                          type: 'string',
                        }),
                        defineField({
                          name: 'price',
                          title: 'Cena',
                          type: 'number',
                        }),
                      ],
                    },
                  ],
                  hidden: ({ parent }) => parent?.kind !== 'choice',
                }),
              ],
            }),
            defineField({
              name: 'value',
              title: 'Wartość techniczna',
              type: 'string',
              description:
                'Unikalna wartość techniczna opcji (używana w kodzie)',
              validation: (Rule) =>
                Rule.required().error('Wartość techniczna jest wymagana'),
            }),
            defineField({
              name: 'basePriceModifier',
              title: 'Modyfikator ceny bazowej',
              type: 'number',
              description:
                'Zmiana ceny bazowej produktu w złotych (dodatnia lub ujemna)',
              initialValue: 0,
            }),
            defineField({
              name: 'featureOverrides',
              title: 'Modyfikacje innych cech',
              type: 'array',
              description:
                'Gdy ta opcja jest wybrana, zmień ceny innych opcji cech',
              of: [
                {
                  type: 'object',
                  name: 'featureOverride',
                  title: 'Modyfikacja cechy',
                  fields: [
                    defineField({
                      name: 'targetFeature',
                      title: 'Nazwa cechy do modyfikacji',
                      type: 'string',
                      description:
                        'Nazwa cechy, której opcje chcesz zmodyfikować (np. "Długość")',
                      validation: (Rule) =>
                        Rule.required().error('Nazwa cechy jest wymagana'),
                    }),
                    defineField({
                      name: 'targetOption',
                      title: 'Wartość opcji do modyfikacji',
                      type: 'string',
                      description:
                        'Wartość techniczna opcji do modyfikacji (np. "1.5m")',
                      validation: (Rule) =>
                        Rule.required().error('Wartość opcji jest wymagana'),
                    }),
                    defineField({
                      name: 'newPrice',
                      title: 'Nowa cena',
                      type: 'number',
                      description:
                        'Nowa cena tej opcji w złotych (zastąpi domyślną cenę)',
                    }),
                    defineField({
                      name: 'newIncrementPrice',
                      title: 'Nowa cena za jednostkę',
                      type: 'number',
                      description:
                        'Nowa cena za jednostkę dla opcji z numeryczną drugą opcją',
                    }),
                  ],
                  preview: {
                    select: {
                      targetFeature: 'targetFeature',
                      targetOption: 'targetOption',
                      newPrice: 'newPrice',
                    },
                    prepare: ({ targetFeature, targetOption, newPrice }) => ({
                      title: `${targetFeature}: ${targetOption}`,
                      subtitle: `→ ${newPrice > 0 ? '+' : ''}${newPrice} zł`,
                      media: Settings,
                    }),
                  },
                },
              ],
            }),
            defineField({
              name: 'isAvailable',
              title: 'Dostępna',
              type: 'boolean',
              description: 'Czy opcja jest obecnie dostępna do wyboru',
              initialValue: true,
            }),
          ],
          preview: {
            select: {
              label: 'label',
              value: 'value',
              basePriceModifier: 'basePriceModifier',
              overridesCount: 'featureOverrides.length',
              isAvailable: 'isAvailable',
            },
            prepare: ({
              label,
              value,
              basePriceModifier,
              overridesCount,
              isAvailable,
            }) => {
              const basePrice = basePriceModifier
                ? `${basePriceModifier > 0 ? '+' : ''}${basePriceModifier} zł`
                : 'Bez dopłaty';
              const overrides = overridesCount
                ? ` • Modyfikuje ${overridesCount} cech`
                : '';
              return {
                title: label || value,
                subtitle: `${basePrice}${overrides}${!isAvailable ? ' • Niedostępna' : ''}`,
                media: isAvailable ? Settings : X,
              };
            },
          },
        },
      ],
    }),
  ],
  preview: {
    select: {
      featureName: 'featureName',
      optionsCount: 'options.length',
      defaultOption: 'options.0.label',
    },
    prepare: ({ featureName, optionsCount, defaultOption }: any) => ({
      title: featureName || 'Cecha produktu',
      subtitle: `${optionsCount || 0} opcji • Domyślna: ${defaultOption || 'Brak'}`,
      media: Settings,
    }),
  },
};

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
      name: 'primaryFeatureKey',
      title: 'Primary Feature Key',
      type: 'string',
      description:
        'Internal: _key of the feature designated as Primary in the Menedżer cech. Optional.',
      hidden: true,
      group: GROUP.MAIN_CONTENT,
    }),
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
      name: 'imageGallery',
      title: 'Galeria zdjęć',
      type: 'array',
      description:
        'Zdjęcia produktu. Pierwsze zdjęcie będzie głównym zdjęciem produktu.',
      of: [{ type: 'image' }],
      validation: (Rule) =>
        Rule.required()
          .min(1)
          .error('Produkt musi mieć co najmniej jedno zdjęcie'),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'shortDescription',
      title: 'Krótki opis',
      type: 'portableText',
      description: 'Krótki opis produktu wyświetlany na górze strony.',
      validation: (Rule) => Rule.required().error('Krótki opis jest wymagany'),
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
      name: 'basePrice',
      title: 'Cena bazowa (PLN)',
      type: 'number',
      description:
        'Podstawowa cena produktu w złotych polskich. Wszystkie modyfikatory cen cech będą dodawane do tej ceny bazowej.',
      validation: (Rule) =>
        Rule.required()
          .min(0.01)
          .error('Cena bazowa jest wymagana i musi być większa niż 0'),
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
        defineField({
          name: 'heading',
          title: 'Nagłówek szczegółów',
          type: 'portableTextHeading',
          description: 'Nagłówek sekcji szczegółów produktu.',
        }),
        defineField({
          name: 'content',
          title: 'Treść szczegółów',
          type: 'portableText',
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
        Rule.required()
          .min(1)
          .error('Produkt musi być dostępny w co najmniej jednym salonie'),
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
      name: 'features',
      title: 'Cechy produktu',
      type: 'array',
      description:
        'Cechy produktu z opcjami konfiguracji. Pierwsza opcja w każdej cechy jest opcją domyślną.',
      hidden: true,
      of: [
        {
          type: 'object',
          name: 'productFeature',
          title: 'Cecha produktu',
          fields: [
            defineField({
              name: 'featureName',
              title: 'Nazwa cechy',
              type: 'string',
              description: 'Nazwa cechy (np. "Model", "Długość", "Kolor")',
              validation: (Rule) =>
                Rule.required().error('Nazwa cechy jest wymagana'),
            }),
            defineField({
              name: 'options',
              title: 'Opcje cechy',
              type: 'array',
              description:
                'Lista dostępnych opcji. Pierwsza opcja jest domyślna.',
              validation: (Rule) =>
                Rule.required()
                  .min(1)
                  .error('Cecha musi mieć co najmniej jedną opcję'),
              of: [
                {
                  type: 'object',
                  name: 'featureOption',
                  title: 'Opcja cechy',
                  fields: [
                    defineField({
                      name: 'label',
                      title: 'Nazwa opcji',
                      type: 'string',
                      description:
                        'Nazwa wyświetlana dla tej opcji (np. "Euphoria", "1.5m", "Złoty")',
                      validation: (Rule) =>
                        Rule.required().error('Nazwa opcji jest wymagana'),
                    }),
                    defineField({
                      name: 'secondOption',
                      title: 'Zagnieżdżona opcja (opcjonalnie)',
                      type: 'object',
                      description:
                        'Dodatkowa konfiguracja dla tej opcji, np. długość własna z zakresem lub podrzędne wybory.',
                      fields: [
                        defineField({
                          name: 'enabled',
                          title: 'Włącz drugą opcję',
                          type: 'boolean',
                          initialValue: false,
                        }),
                        defineField({
                          name: 'kind',
                          title: 'Rodzaj',
                          type: 'string',
                          options: {
                            list: [
                              {
                                title: 'Liczbowa (np. długość)',
                                value: 'numeric',
                              },
                              { title: 'Wybór (lista opcji)', value: 'choice' },
                            ],
                            layout: 'radio',
                          },
                        }),
                        defineField({
                          name: 'numeric',
                          title: 'Konfiguracja liczbowa',
                          type: 'object',
                          fields: [
                            defineField({
                              name: 'label',
                              title: 'Etykieta pola',
                              description:
                                'Tekst wyświetlany przy polu (np. "Długość")',
                              type: 'string',
                            }),
                            defineField({
                              name: 'unit',
                              title: 'Jednostka',
                              type: 'string',
                            }),
                            defineField({
                              name: 'min',
                              title: 'Minimalna wartość',
                              type: 'number',
                            }),
                            defineField({
                              name: 'max',
                              title: 'Maksymalna wartość',
                              type: 'number',
                            }),
                            defineField({
                              name: 'step',
                              title: 'Krok',
                              type: 'number',
                            }),
                            defineField({
                              name: 'perUnitPrice',
                              title: 'Cena za jednostkę',
                              type: 'number',
                            }),
                          ],
                          hidden: ({ parent }) => parent?.kind !== 'numeric',
                        }),
                        defineField({
                          name: 'choices',
                          title: 'Podrzędne opcje',
                          type: 'array',
                          of: [
                            {
                              type: 'object',
                              name: 'secondChoice',
                              fields: [
                                defineField({
                                  name: 'label',
                                  title: 'Nazwa',
                                  type: 'string',
                                }),
                                defineField({
                                  name: 'value',
                                  title: 'Wartość',
                                  type: 'string',
                                }),
                                defineField({
                                  name: 'price',
                                  title: 'Cena',
                                  type: 'number',
                                }),
                              ],
                            },
                          ],
                          hidden: ({ parent }) => parent?.kind !== 'choice',
                        }),
                      ],
                    }),
                    defineField({
                      name: 'value',
                      title: 'Wartość techniczna',
                      type: 'string',
                      description:
                        'Unikalna wartość techniczna opcji (używana w kodzie)',
                      validation: (Rule) =>
                        Rule.required().error(
                          'Wartość techniczna jest wymagana'
                        ),
                    }),
                    defineField({
                      name: 'basePriceModifier',
                      title: 'Modyfikator ceny bazowej',
                      type: 'number',
                      description:
                        'Zmiana ceny bazowej produktu w złotych (dodatnia lub ujemna)',
                      initialValue: 0,
                    }),
                    defineField({
                      name: 'featureOverrides',
                      title: 'Modyfikacje innych cech',
                      type: 'array',
                      description:
                        'Gdy ta opcja jest wybrana, zmień ceny innych opcji cech',
                      of: [
                        {
                          type: 'object',
                          name: 'featureOverride',
                          title: 'Modyfikacja cechy',
                          fields: [
                            defineField({
                              name: 'targetFeature',
                              title: 'Nazwa cechy do modyfikacji',
                              type: 'string',
                              description:
                                'Nazwa cechy, której opcje chcesz zmodyfikować (np. "Długość")',
                              validation: (Rule) =>
                                Rule.required().error(
                                  'Nazwa cechy jest wymagana'
                                ),
                            }),
                            defineField({
                              name: 'targetOption',
                              title: 'Wartość opcji do modyfikacji',
                              type: 'string',
                              description:
                                'Wartość techniczna opcji do modyfikacji (np. "1.5m")',
                              validation: (Rule) =>
                                Rule.required().error(
                                  'Wartość opcji jest wymagana'
                                ),
                            }),
                            defineField({
                              name: 'newPrice',
                              title: 'Nowa cena',
                              type: 'number',
                              description:
                                'Nowa cena tej opcji w złotych (zastąpi domyślną cenę)',
                            }),
                            defineField({
                              name: 'newIncrementPrice',
                              title: 'Nowa cena za jednostkę',
                              type: 'number',
                              description:
                                'Nowa cena za jednostkę dla opcji z numeryczną drugą opcją',
                            }),
                          ],
                          preview: {
                            select: {
                              targetFeature: 'targetFeature',
                              targetOption: 'targetOption',
                              newPrice: 'newPrice',
                            },
                            prepare: ({
                              targetFeature,
                              targetOption,
                              newPrice,
                            }) => ({
                              title: `${targetFeature}: ${targetOption}`,
                              subtitle: `→ ${newPrice > 0 ? '+' : ''}${newPrice} zł`,
                              media: Settings,
                            }),
                          },
                        },
                      ],
                    }),
                    defineField({
                      name: 'isAvailable',
                      title: 'Dostępna',
                      type: 'boolean',
                      description: 'Czy opcja jest obecnie dostępna do wyboru',
                      initialValue: true,
                    }),
                  ],
                  preview: {
                    select: {
                      label: 'label',
                      value: 'value',
                      basePriceModifier: 'basePriceModifier',
                      overridesCount: 'featureOverrides.length',
                      isAvailable: 'isAvailable',
                    },
                    prepare: ({
                      label,
                      value,
                      basePriceModifier,
                      overridesCount,
                      isAvailable,
                    }) => {
                      const basePrice = basePriceModifier
                        ? `${basePriceModifier > 0 ? '+' : ''}${basePriceModifier} zł`
                        : 'Bez dopłaty';
                      const overrides = overridesCount
                        ? ` • Modyfikuje ${overridesCount} cech`
                        : '';

                      return {
                        title: label || value,
                        subtitle: `${basePrice}${overrides}${!isAvailable ? ' • Niedostępna' : ''}`,
                        media: isAvailable ? Settings : X,
                      };
                    },
                  },
                },
              ],
            }),
          ],
          preview: {
            select: {
              featureName: 'featureName',
              optionsCount: 'options.length',
              defaultOption: 'options.0.label',
            },
            prepare: ({ featureName, optionsCount, defaultOption }) => {
              return {
                title: featureName || 'Cecha produktu',
                subtitle: `${optionsCount || 0} opcji • Domyślna: ${defaultOption || 'Brak'}`,
                media: Settings,
              };
            },
          },
        },
      ],
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'featureConfig',
      title: 'Konfigurator cech (v2)',
      type: 'object',
      description:
        'Nowy model konfiguratora cech. Jeśli włączona cecha główna, warianty zawierają własne cechy podrzędne. W przeciwnym razie użyj listy cech podrzędnych.',
      hidden: true,
      fields: [
        defineField({
          name: 'primary',
          title: 'Cecha główna',
          type: 'object',
          fields: [
            defineField({ name: 'name', title: 'Nazwa', type: 'string' }),
            defineField({
              name: 'variants',
              title: 'Warianty',
              type: 'array',
              of: [
                {
                  type: 'object',
                  name: 'primaryVariantV2',
                  title: 'Wariant cechy głównej',
                  fields: [
                    defineField({
                      name: 'label',
                      title: 'Etykieta',
                      type: 'string',
                    }),
                    defineField({
                      name: 'value',
                      title: 'Wartość',
                      type: 'string',
                    }),
                    defineField({
                      name: 'basePrice',
                      title: 'Cena bazowa (PLN)',
                      type: 'number',
                      description:
                        'Cena bazowa dla tego wariantu w złotych polskich',
                      validation: (Rule) =>
                        Rule.required()
                          .min(0.01)
                          .error(
                            'Cena bazowa jest wymagana i musi być większa niż 0'
                          ),
                    }),
                    defineField({
                      name: 'secondaryFeatures',
                      title: 'Cechy podrzędne',
                      type: 'array',
                      of: [productFeatureObject],
                    }),
                  ],
                },
              ],
            }),
          ],
        }),
        defineField({
          name: 'secondaryFeatures',
          title: 'Cechy podrzędne (bez cechy głównej)',
          type: 'array',
          of: [productFeatureObject],
        }),
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
