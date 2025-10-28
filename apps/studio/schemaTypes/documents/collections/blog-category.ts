import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { BookOpen } from 'lucide-react';
import { defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { customPortableText } from '../../portableText';
import { getSEOFields } from '../../shared/seo';

export const blogCategory = defineType({
  name: 'blog-category',
  title: 'Kategoria bloga',
  type: 'document',
  icon: BookOpen,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Kategoria bloga. Kategorie bloga grupują wpisy na blogu w szerokie tematy.',
  fields: [
    orderRankField({ type: 'blog-category' }),
    ...defineSlugForDocument({
      prefix: '/blog/',
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: 'title',
      title: 'Tytuł kategorii (opcjonalnie)',
      description:
        'Niestandardowy tytuł dla strony kategorii. Jeśli nie ustawiony, używany będzie domyślny tytuł z głównej strony bloga. Ustaw aby nadpisać domyślny tytuł.',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: [],
        decorators: ['strong'],
      },
    }),
    customPortableText({
      name: 'description',
      title: 'Opis kategorii (opcjonalnie)',
      description:
        'Niestandardowy opis dla strony kategorii. Jeśli nie ustawiony, używany będzie domyślny opis z głównej strony bloga. Ustaw aby nadpisać domyślny opis.',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: [],
        decorators: ['strong', 'em'],
      },
    }),
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: 'name',
      description: 'description',
      slug: 'slug.current',
    },
    prepare: ({ name, slug }) => ({
      title: name || 'Kategoria bloga',
      media: BookOpen,
      subtitle: slug,
    }),
  },
});
