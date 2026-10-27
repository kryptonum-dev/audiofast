import { SplitHorizontalIcon } from '@sanity/icons/SplitHorizontal';
import { defineField, defineType } from 'sanity';

export const ptTwoColumnLine = defineType({
  name: 'ptTwoColumnLine',
  type: 'object',
  title: 'Nowa sekcja',
  icon: SplitHorizontalIcon,
  description:
    'Kończy jedną część opisu i zaczyna następną. Część z „Podziałem kolumn” ma dwie kolumny, część bez niego ma jedną.',
  fields: [
    defineField({
      name: 'style',
      title: 'Styl',
      type: 'string',
      initialValue: 'twoColumnLine',
      hidden: true,
      readOnly: true,
    }),
  ],
  preview: {
    prepare: () => ({
      title: 'Nowa sekcja',
      subtitle: 'Tu kończy się jedna część opisu i zaczyna następna',
      media: SplitHorizontalIcon,
    }),
  },
});
