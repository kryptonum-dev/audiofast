import { LayoutPanelLeft, Link, PanelTop } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { buttonsField } from '../shared';

const navbarLink = defineField({
  name: 'navbarLink',
  type: 'object',
  icon: Link,
  title: 'Link nawigacyjny',
  description: 'Pojedynczy link nawigacyjny z nazwą i URL',
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      title: 'Tekst linku',
      description:
        'Tekst, który będzie wyświetlany dla tego linku nawigacyjnego',
    }),
    defineField({
      name: 'url',
      type: 'customUrl',
      title: 'URL linku',
      description: 'URL, do którego będzie prowadził ten link po kliknięciu',
    }),
  ],
  preview: {
    select: {
      title: 'name',
      externalUrl: 'url.external',
      urlType: 'url.type',
      internalUrl: 'url.internal.slug.current',
      openInNewTab: 'url.openInNewTab',
    },
    prepare({ title, externalUrl, urlType, internalUrl, openInNewTab }) {
      const url = urlType === 'external' ? externalUrl : internalUrl;
      const newTabIndicator = openInNewTab ? ' ↗' : '';
      const truncatedUrl =
        url?.length > 30 ? `${url.substring(0, 30)}...` : url;

      return {
        title: title || 'Untitled Link',
        subtitle: `${urlType === 'external' ? 'Zewnętrzny' : 'Wewnętrzny'} • ${truncatedUrl}${newTabIndicator}`,
        media: Link,
      };
    },
  },
});

const navbarColumnLink = defineField({
  name: 'navbarColumnLink',
  type: 'object',
  icon: LayoutPanelLeft,
  title: 'Link kolumny nawigacyjnej',
  description: 'Link w kolumnie nawigacyjnej',
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      title: 'Tekst linku',
      description:
        'Tekst, który będzie wyświetlany dla tego linku nawigacyjnego',
    }),
    defineField({
      name: 'description',
      type: 'string',
      title: 'Opis',
      description: 'Opis dla tego linku nawigacyjnego',
    }),
    defineField({
      name: 'url',
      type: 'customUrl',
      title: 'URL linku',
      description: 'URL, do którego będzie prowadził ten link po kliknięciu',
    }),
  ],
  preview: {
    select: {
      title: 'name',
      externalUrl: 'url.external',
      urlType: 'url.type',
      internalUrl: 'url.internal.slug.current',
      openInNewTab: 'url.openInNewTab',
    },
    prepare({ title, externalUrl, urlType, internalUrl, openInNewTab }) {
      const url = urlType === 'external' ? externalUrl : internalUrl;
      const newTabIndicator = openInNewTab ? ' ↗' : '';
      const truncatedUrl =
        url?.length > 30 ? `${url.substring(0, 30)}...` : url;

      return {
        title: title || 'Untitled Link',
        subtitle: `${urlType === 'external' ? 'Zewnętrzny' : 'Wewnętrzny'} • ${truncatedUrl}${newTabIndicator}`,
        media: Link,
      };
    },
  },
});

const navbarColumn = defineField({
  name: 'navbarColumn',
  type: 'object',
  icon: LayoutPanelLeft,
  title: 'Kolumna nawigacyjna',
  description: 'Kolumna linków nawigacyjnych z opcjonalnym tytułem',
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      title: 'Tytuł kolumny',
      description:
        'Tekst nagłówka wyświetlany nad tą grupą linków nawigacyjnych',
    }),
    defineField({
      name: 'links',
      type: 'array',
      title: 'Linki kolumny',
      validation: (rule) => [rule.required(), rule.unique()],
      description: 'Lista linków nawigacyjnych do wyświetlenia w tej kolumnie',
      of: [navbarColumnLink],
    }),
  ],
  preview: {
    select: {
      title: 'title',
      links: 'links',
    },
    prepare({ title, links = [] }) {
      return {
        title: title || 'Untitled Column',
        subtitle: `${links.length} link${links.length === 1 ? '' : 's'}`,
      };
    },
  },
});

export const navbar = defineType({
  name: 'navbar',
  title: 'Nawigacja strony',
  type: 'document',
  icon: PanelTop,
  description: 'Konfiguruj główną strukturę nawigacji dla swojej strony',
  fields: [
    defineField({
      name: 'label',
      type: 'string',
      initialValue: 'Nawigacja',
      title: 'Etykieta nawigacji',
      description:
        'Wewnętrzna etykieta do identyfikacji tej konfiguracji nawigacji w CMS',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'columns',
      type: 'array',
      title: 'Struktura nawigacji',
      description:
        'Zbuduj swoje menu nawigacji używając kolumn i linków. Dodaj kolumnę linków lub pojedyncze linki.',
      of: [navbarColumn, navbarLink],
    }),
    buttonsField,
  ],
  preview: {
    select: {
      title: 'label',
    },
    prepare: ({ title }) => ({
      title: title || 'Untitled Navigation',
    }),
  },
});
