import { BookOpen } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { customPortableText } from '../../portableText';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const blog = defineType({
  name: 'blog',
  type: 'document',
  title: 'Strona bloga',
  icon: BookOpen,
  groups: GROUPS,
  fields: [
    ...defineSlugForDocument({
      slug: '/blog/',
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: 'title',
      title: 'Tytuł strony bloga',
      description: 'Główny tytuł wyświetlany w sekcji hero na stronie bloga',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: [],
        decorators: ['strong'],
        annotations: [],
      },
      validation: (Rule) =>
        Rule.required().error('Tytuł sekcji hero jest wymagany'),
    }),
    customPortableText({
      name: 'description',
      title: 'Opis strony bloga',
      description:
        'Krótki opis wyświetlany pod tytułem w sekcji hero na stronie bloga',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: [],
        decorators: ['strong', 'em'],
        annotations: [],
      },
    }),
    defineField({
      name: 'heroImage',
      title: 'Obraz tła strony bloga',
      type: 'image',
      description: 'Obraz wyświetlany w tle sekcji hero na stronie bloga',
      group: GROUP.MAIN_CONTENT,
      options: {
        hotspot: true,
      },
      validation: (Rule) =>
        Rule.required().error('Obraz tła sekcji hero jest wymagany'),
    }),
    pageBuilderField,
    ...getSEOFields({ exclude: ['doNotIndex', 'hideFromList'] }),
  ],
  preview: {
    select: {
      name: 'name',
    },
    prepare: ({ name }) => ({
      title: name || 'Blog',
      media: BookOpen,
    }),
  },
});
