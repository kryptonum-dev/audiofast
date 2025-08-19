import { LayoutPanelLeft, Link, PanelBottom } from 'lucide-react';
import { defineField, defineType } from 'sanity';

const footerColumnLink = defineField({
  name: 'footerColumnLink',
  type: 'object',
  icon: Link,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      title: 'Nazwa',
      description: 'Nazwa dla linku',
    }),
    defineField({
      name: 'url',
      type: 'customUrl',
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

const footerColumn = defineField({
  name: 'footerColumn',
  type: 'object',
  icon: LayoutPanelLeft,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      title: 'Tytuł',
      description: 'Tytuł dla kolumny',
    }),
    defineField({
      name: 'links',
      type: 'array',
      title: 'Linki',
      description: 'Linki dla kolumny',
      of: [footerColumnLink],
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

export const footer = defineType({
  name: 'footer',
  type: 'document',
  title: 'Stopka',
  description: 'Treść stopki dla Twojej strony internetowej',
  fields: [
    defineField({
      name: 'label',
      type: 'string',
      initialValue: 'Stopka',
      title: 'Etykieta',
      description: 'Etykieta używana do identyfikacji stopki w CMS',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'subtitle',
      type: 'text',
      rows: 2,
      title: 'Podtytuł',
      description: 'Podtytuł, który znajduje się pod logo w stopce',
    }),
    defineField({
      name: 'columns',
      type: 'array',
      title: 'Kolumny',
      description: 'Kolumny dla stopki',
      of: [footerColumn],
    }),
  ],
  preview: {
    select: {
      title: 'label',
    },
    prepare: ({ title }) => ({
      title: title || 'Untitled Footer',
      media: PanelBottom,
    }),
  },
});
