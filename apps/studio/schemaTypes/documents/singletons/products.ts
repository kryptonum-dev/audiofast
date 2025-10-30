import { BrickWallShield, Package } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { customPortableText } from '../../portableText';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const products = defineType({
  name: 'products',
  type: 'document',
  title: 'Strona produktów',
  icon: BrickWallShield,
  groups: GROUPS,
  description:
    'Strona z produktami audio. Skonfiguruj treść strony, na której będą wyświetlane wszystkie produkty audio.',
  fields: [
    ...defineSlugForDocument({
      slug: '/produkty/',
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: 'title',
      title: 'Tytuł strony produktów',
      description:
        'Główny tytuł wyświetlany w sekcji hero na stronie produktów',
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
      title: 'Opis strony produktów',
      description:
        'Krótki opis wyświetlany pod tytułem w sekcji hero na stronie produktów',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: [],
        decorators: ['strong', 'em'],
        annotations: [],
      },
      validation: (Rule) =>
        Rule.required().error('Opis strony produktów jest wymagany'),
    }),
    defineField({
      name: 'heroImage',
      title: 'Obraz tła strony produktów',
      type: 'image',
      description: 'Obraz wyświetlany w tle sekcji hero na stronie produktów',
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
      slug: 'slug.current',
    },
    prepare: ({ name }) => ({
      title: name || 'Produkty',
      media: Package,
    }),
  },
});
