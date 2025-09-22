import { Link } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { createRadioListLayout } from '../../utils/helper';

const buttonVariants = [
  { title: 'Główny', value: 'primary' },
  { title: 'Drugorzędny', value: 'secondary' },
];

export const button = defineType({
  name: 'button',
  title: 'Przycisk',
  type: 'object',
  icon: Link,
  fields: [
    defineField({
      name: 'variant',
      type: 'string',
      title: 'Styl przycisku',
      description: 'Wybierz styl przycisku',
      initialValue: () => 'primary',
      options: createRadioListLayout(buttonVariants, {
        direction: 'horizontal',
      }),
    }),
    defineField({
      name: 'text',
      title: 'Tekst przycisku',
      type: 'string',
      description: 'Tekst, który pojawi się na przycisku',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'Adres URL',
      type: 'customUrl',
      description:
        'Gdzie przekierowuje przycisk - może być stroną wewnętrzną lub zewnętrzną',
    }),
  ],
  preview: {
    select: {
      title: 'text',
      variant: 'variant',
      externalUrl: 'url.external',
      urlType: 'url.type',
      internalUrl: 'url.internal.slug.current',
      openInNewTab: 'url.openInNewTab',
    },
    prepare: ({
      title,
      variant,
      externalUrl,
      urlType,
      internalUrl,
      openInNewTab,
    }) => {
      const url = urlType === 'external' ? externalUrl : internalUrl;
      const newTabIndicator = openInNewTab ? ' ↗' : '';
      const truncatedUrl =
        url?.length > 30 ? `${url.substring(0, 30)}...` : url;

      const variantTitle = buttonVariants.find(
        (v) => v.value === variant
      )?.title;
      return {
        title: title || 'Nienazwany przycisk',
        subtitle: `${variantTitle} • ${truncatedUrl}${newTabIndicator}`,
      };
    },
  },
});

// Reusable button without variant selection (for navigation, footers, etc.)
export const buttonWithNoVariant = defineType({
  name: 'buttonWithNoVariant',
  title: 'Przycisk bez wariantów',
  type: 'object',
  icon: Link,
  fields: [
    defineField({
      name: 'text',
      title: 'Tekst przycisku',
      type: 'string',
      description: 'Tekst, który pojawi się w nawigacji',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'Adres URL',
      type: 'customUrl',
      description:
        'Gdzie przekierowuje link - może być stroną wewnętrzną lub zewnętrzną',
    }),
  ],
  preview: {
    select: {
      title: 'text',
      externalUrl: 'url.external',
      urlType: 'url.type',
      internalUrl: 'url.internal.slug.current',
      openInNewTab: 'url.openInNewTab',
    },
    prepare: ({ title, externalUrl, urlType, internalUrl, openInNewTab }) => {
      const url = urlType === 'external' ? externalUrl : internalUrl;
      const newTabIndicator = openInNewTab ? ' ↗' : '';
      const truncatedUrl =
        url?.length > 30 ? `${url.substring(0, 30)}...` : url;

      return {
        title: title || 'Nienazwany link',
        subtitle: `${truncatedUrl}${newTabIndicator}`,
      };
    },
  },
});
