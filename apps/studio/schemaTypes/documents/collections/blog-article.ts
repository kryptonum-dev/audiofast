import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { FileTextIcon } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { customPortableText } from '../../definitions/portable-text';
import { getSEOFields } from '../../shared/seo';

export const blogArticle = defineType({
  name: 'blog-article',
  title: 'Wpis na blogu',
  type: 'document',
  icon: FileTextIcon,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Artykuł blogowy, który zostanie opublikowany na stronie internetowej. Dodaj tytuł, opis, autora i treść, aby utworzyć nowy artykuł dla czytających.',
  fields: [
    orderRankField({ type: 'blog' }),
    ...defineSlugForDocument({
      prefix: '/blog/',
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'category',
      type: 'reference',
      title: 'Kategoria',
      to: [{ type: 'blog-category' }],
      validation: (Rule) => Rule.required(),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'image',
      title: 'Obraz główny',
      type: 'image',
      description:
        'Główny obraz artykułu wyświetlany w sekcji najnowszej publikacji',
      group: GROUP.MAIN_CONTENT,
      options: {
        hotspot: true,
      },
      validation: (Rule) => Rule.required().error('Obraz główny jest wymagany'),
    }),
    customPortableText({
      name: 'title',
      title: 'Tytuł artykułu',
      description:
        'Główny tytuł artykułu wyświetlany w sekcji najnowszej publikacji',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: [],
        decorators: ['strong'],
        annotations: ['customLink'],
      },
    }),
    customPortableText({
      name: 'description',
      title: 'Opis artykułu',
      description:
        'Krótki opis artykułu wyświetlany w sekcji najnowszej publikacji',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: ['bullet', 'number'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
    }),
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: 'name',
      description: 'description',
    },
    prepare: ({ name, description }) => ({
      title: name || 'Artykuł blogowy',
      media: FileTextIcon,
      subtitle: description || 'Artykuł blogowy',
    }),
  },
});
