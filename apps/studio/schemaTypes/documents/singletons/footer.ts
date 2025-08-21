import { Link, PanelBottom } from 'lucide-react';
import { defineField, defineType } from 'sanity';

const footerLink = defineField({
  name: 'footerLink',
  type: 'object',
  icon: Link,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      title: 'Nazwa',
      description: 'Nazwa dla linku',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      type: 'customUrl',
      title: 'URL',
      description: 'Adres URL dla linku',
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

export const footer = defineType({
  name: 'footer',
  type: 'document',
  title: 'Stopka',
  description: 'Treść stopki dla Twojej strony internetowej',
  fields: [
    defineField({
      name: 'highlightedSocialMedia',
      type: 'array',
      title: 'Wyróżnione media społecznościowe',
      validation: (Rule) => [
        Rule.required().error('Wyróżnione media społecznościowe są wymagane'),
        Rule.min(1).error('Minimum 1 wyróżnione media społecznościowe'),
        Rule.max(3).error('Maksimum 3 wyróżnione media społecznościowe'),
      ],
      of: [
        {
          type: 'reference',
          to: [{ type: 'socialMedia' }],
          options: {
            filter: ({ document }) => {
              const selectedIds = Array.isArray(
                document?.highlightedSocialMedia
              )
                ? document.highlightedSocialMedia
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
    }),
    defineField({
      name: 'links',
      type: 'array',
      title: 'Linki w stopce',
      of: [footerLink],
      validation: (rule) => [
        rule.required().error('Linki są wymagane'),
        rule.min(2).error('Minimum 2 linki'),
        rule.max(6).error('Maksimum 6 linków'),
      ],
    }),
    defineField({
      name: 'newsletter',
      type: 'object',
      title: 'Newsletter',
      fields: [
        defineField({
          name: 'label',
          type: 'string',
          title: 'Etykieta sekcji',
          description: 'Tekst dla sekcji newslettera',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'buttonLabel',
          type: 'string',
          title: 'Etykieta przycisku',
          validation: (rule) => rule.required(),
        }),
      ],
    }),
  ],
  preview: {
    select: {
      links: 'links',
    },
    prepare: () => ({
      title: 'Stopka',
      media: PanelBottom,
    }),
  },
});
