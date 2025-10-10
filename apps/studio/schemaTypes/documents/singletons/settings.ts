import { CogIcon } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';

export const settings = defineType({
  name: 'settings',
  type: 'document',
  title: 'Ustawienia globalne',
  description:
    'Globalne ustawienia i konfiguracja dla Twojej strony internetowej',
  icon: CogIcon,
  groups: GROUPS,
  fields: [
    defineField({
      name: 'email',
      type: 'string',
      title: 'Email kontaktowy',
      group: GROUP.CONTACT,
      validation: (Rule) => Rule.required().email(),
    }),
    defineField({
      name: 'tel',
      type: 'string',
      title: 'Telefon kontaktowy',
      group: GROUP.CONTACT,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'address',
      type: 'object',
      title: 'Adres firmy',
      description: 'Pełny adres firmy rozdzielony na komponenty',
      group: GROUP.CONTACT,
      options: {
        columns: 2,
      },
      fields: [
        defineField({
          name: 'streetAddress',
          type: 'string',
          title: 'Ulica i numer',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'postalCode',
          type: 'string',
          title: 'Kod pocztowy',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'city',
          type: 'string',
          title: 'Miasto',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'country',
          type: 'string',
          title: 'Kraj',
          initialValue: 'PL',
          validation: (Rule) => Rule.required(),
        }),
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'analytics',
      type: 'object',
      title: 'Analityka',
      description:
        'Konfiguruj analitykę strony. Pozostaw pola puste, aby wyłączyć śledzenie.',
      group: GROUP.SEO,
      fields: [
        defineField({
          name: 'gtm_id',
          type: 'string',
          title: 'Google Tag Manager ID',
          description:
            'Format: GTM-XXXXXXX. ID kontenera do zarządzania narzędziami analitycznymi (GA4, Facebook Pixel, etc.).',
          validation: (Rule) =>
            Rule.regex(/^GTM-[A-Z0-9]+$/, {
              name: 'GTM format',
              invert: false,
            }).error('Format: GTM-XXXXXXX'),
        }),
        defineField({
          name: 'ga4_id',
          type: 'string',
          title: 'Google Analytics Measurement ID',
          description:
            'Format: G-XXXXXXXXXXX. Używane do śledzenia Google Analytics.',
          validation: (Rule) =>
            Rule.regex(/^G-[A-Z0-9]+$/, {
              name: 'GA4 format',
              invert: false,
            }).error('Format: G-XXXXXXXXXXX'),
        }),
        defineField({
          name: 'googleAds_id',
          type: 'string',
          title: 'Google Ads Conversion ID',
          description:
            'Format: AW-XXXXXXXXXX. Używane do śledzenia konwersji i remarketingu w Google Ads.',
          validation: (Rule) =>
            Rule.regex(/^AW-[A-Z0-9]+$/, {
              name: 'Google Ads format',
              invert: false,
            }).error('Format: AW-XXXXXXXXXX'),
        }),
      ],
    }),
    defineField({
      name: 'seo',
      type: 'object',
      title: 'SEO globalne',
      group: GROUP.SEO,
      fields: [
        defineField({
          name: 'img',
          type: 'image',
          title: 'Obraz Open Graph',
          description:
            'Obraz Open Graph jest widoczny podczas udostępniania strony w mediach społecznościowych. Rozmiar obrazu powinien wynosić 1200x630px. Dla maksymalnej kompatybilności, użyj formatów JPG lub PNG, ponieważ WebP może nie być obsługiwany wszędzie.',
          validation: (Rule) => Rule.required(),
        }),
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'structuredData',
      type: 'object',
      title: 'Structured Data (Schema.org)',
      description:
        'Dane strukturalne dla lepszego SEO i widoczności w wyszukiwarkach',
      group: GROUP.SEO,
      fields: [
        defineField({
          name: 'companyName',
          type: 'string',
          title: 'Nazwa firmy',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'companyDescription',
          type: 'text',
          title: 'Opis firmy',
          description:
            'Krótki opis firmy dla SEO i structured data (1-2 zdania)',
          validation: (Rule) => Rule.required().max(300),
        }),
        defineField({
          name: 'logo',
          type: 'image',
          title: 'Logo firmy',
          description:
            'Logo firmy - używane w structured data. Preferowany format: kwadratowy, min. 112x112px',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'geo',
          type: 'object',
          title: 'Współrzędne geograficzne',
          description:
            'Lokalizacja GPS firmy dla map i structured data (opcjonalne)',
          fields: [
            defineField({
              name: 'latitude',
              type: 'number',
              title: 'Szerokość geograficzna',
            }),
            defineField({
              name: 'longitude',
              type: 'number',
              title: 'Długość geograficzna',
            }),
          ],
        }),
        defineField({
          name: 'priceRange',
          type: 'string',
          title: 'Przedział cenowy',
          options: {
            list: [
              { title: '$ (Niskie ceny)', value: '$' },
              { title: '$$ (Średnie ceny)', value: '$$' },
              { title: '$$$ (Wysokie ceny)', value: '$$$' },
              { title: '$$$$ (Bardzo wysokie ceny)', value: '$$$$' },
            ],
            layout: 'radio',
          },
          initialValue: '$$',
          validation: (Rule) => Rule.required(),
        }),
      ],
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      label: 'label',
    },
    prepare: ({ label }) => ({
      title: label || 'Ustawienia globalne',
      media: CogIcon,
    }),
  },
});
