import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { FileTextIcon } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { parsePortableTextToString } from '../../../utils/helper';
import { customPortableText } from '../../portableText';
import { pageBuilderField } from '../../shared';
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
    defineField({
      name: 'name',
      title: 'Nazwa artykułu',
      type: 'string',
      description:
        'Krótka nazwa artykułu używana w breadcrumbs i do generowania URL (np. "Najlepsze soundbary 2024")',
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) =>
        Rule.required().error('Nazwa artykułu jest wymagana'),
    }),
    ...defineSlugForDocument({
      prefix: '/blog/',
      source: 'name',
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: 'title',
      title: 'Tytuł artykułu',
      description:
        'Główny tytuł artykułu wyświetlany jako nagłówek (może zawierać formatowanie)',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: [],
        decorators: ['strong'],
        annotations: ['customLink'],
      },
      validation: (Rule) =>
        Rule.required().error('Tytuł artykułu jest wymagany'),
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
    defineField({
      name: 'category',
      type: 'reference',
      title: 'Kategoria',
      to: [{ type: 'blog-category' }],
      validation: (Rule) => Rule.required(),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'publishedDate',
      title: 'Nadpisz datę publikacji',
      type: 'datetime',
      description:
        'Niestandardowa data publikacji artykułu. Opcjonalne - jeśli nie jest ustawiona, używana jest domyślna data utworzenia dokumentu. Przydatne przy migracji artykułów z innych systemów.',
      group: GROUP.MAIN_CONTENT,
      options: {
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
      },
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
      name: 'content',
      title: 'Treść',
      description: 'Główna treść artykułu',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal', 'h2', 'h3'],
        lists: ['bullet', 'number'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
      components: [
        'ptImage',
        'ptArrowList',
        'ptCircleNumberedList',
        'ptCtaSection',
        'ptTwoColumnTable',
        'ptFeaturedProducts',
        'ptQuote',
        'ptButton',
        'ptImageSlider',
        'ptYoutubeVideo',
        'ptVimeoVideo',
      ],
    }),
    pageBuilderField,
    defineField({
      name: 'author',
      type: 'reference',
      title: 'Autor',
      to: [{ type: 'teamMember' }],
      description:
        'Autor artykułu - wymagane dla optymalizacji SEO (structured data)',
      validation: (Rule) =>
        Rule.required().error('Autor artykułu jest wymagany'),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'keywords',
      title: 'Słowa kluczowe',
      type: 'array',
      of: [{ type: 'string' }],
      description:
        'Słowa kluczowe dla SEO i structured data (np. "soundbar", "audio", "recenzja"). Maksymalnie 10 słów kluczowych.',
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) =>
        Rule.max(10).error('Maksymalnie 10 słów kluczowych'),
      options: {
        layout: 'tags',
      },
    }),
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: 'name',
      description: 'description',
      image: 'image',
    },
    prepare: ({ name, description, image }) => ({
      title: name || 'Artykuł blogowy',
      media: image || FileTextIcon,
      subtitle: parsePortableTextToString(description) || 'Artykuł blogowy',
    }),
  },
});
