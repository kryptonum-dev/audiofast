import { Users2Icon } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { isProduction, isValidUrl } from '../../../utils/helper';

export default defineType({
  name: 'socialMedia',
  type: 'document',
  title: 'Media społecznościowe',
  icon: Users2Icon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      title: 'Nazwa',
      validation: (Rule) => Rule.required(),
      hidden: isProduction(),
    }),
    defineField({
      name: 'link',
      type: 'url',
      title: 'Link',
      validation: (Rule) => [
        Rule.custom((value) => {
          if (!value) return true;
          if (!value.startsWith('https://')) {
            return 'Link zewnętrzny musi zaczynać się od protokołu "https://"';
          }
          if (!isValidUrl(value)) return 'Nieprawidłowy URL';

          return true;
        }),
      ],
    }),
    defineField({
      name: 'icon',
      type: 'image',
      title: 'Ikona',
      options: {
        accept: '.svg',
      },
      validation: (Rule) => Rule.required(),
      hidden: isProduction(),
    }),
    defineField({
      name: 'iconString',
      type: 'text',
      title: 'Tekst ikony',
      validation: (Rule) => Rule.required(),
      hidden: isProduction(),
    }),
  ],
  preview: {
    select: {
      title: 'name',
      link: 'link',
      icon: 'icon',
    },
    prepare: ({ title, link, icon }) => ({
      title,
      subtitle: link,
      media: icon,
    }),
  },
});
