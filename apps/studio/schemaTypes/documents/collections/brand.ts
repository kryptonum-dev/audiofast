import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { Tag } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { toPlainText } from '../../../utils/helper';
import { customPortableText } from '../../portableText';
import { getSEOFields } from '../../shared/seo';

export const brand = defineType({
  name: 'brand',
  title: 'Marka',
  type: 'document',
  icon: Tag,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Marka produktów audio. Dodaj nazwę marki, opis i informacje o producencie.',
  fields: [
    orderRankField({ type: 'brands' }),
    ...defineSlugForDocument({
      prefix: '/marki/',
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'logo',
      title: 'Logo Marki',
      type: 'image',
      validation: (Rule) => Rule.required(),
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: 'description',
      title: 'Opis marki (Hero)',
      description:
        'Krótki opis wyświetlany pod nazwą marki w sekcji hero na stronie marki',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        decorators: ['strong', 'em'],
      },
      validation: (Rule) => Rule.required().error('Opis marki jest wymagany'),
    }),
    defineField({
      name: 'heroImage',
      title: 'Obraz tła strony marki',
      type: 'image',
      description: 'Obraz wyświetlany w tle sekcji hero na stronie marki',
      group: GROUP.MAIN_CONTENT,
      options: {
        hotspot: true,
      },
      validation: (Rule) =>
        Rule.required().error('Obraz tła sekcji hero jest wymagany'),
    }),
    defineField({
      name: 'bannerImage',
      title: 'Obraz banera (opcjonalny)',
      type: 'image',
      description:
        'Duży obraz banera wyświetlany między listą produktów a sekcją o marce',
      group: GROUP.MAIN_CONTENT,
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'distributionStartYear',
      title: 'Rok rozpoczęcia dystrybucji (opcjonalny)',
      type: 'number',
      description:
        'Rok, w którym AudioFast rozpoczął dystrybucję tej marki (np. 2005)',
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) =>
        Rule.min(1900)
          .max(new Date().getFullYear())
          .error('Podaj prawidłowy rok'),
    }),
    customPortableText({
      name: 'brandDescription',
      title: 'Szczegółowy opis',
      description:
        'Szczegółowy opis marki wyświetlany w sekcji dwukolumnowej na stronie marki',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: ['bullet', 'number'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
      components: ['ptImage', 'ptHeading'],
    }),
    defineField({
      name: 'imageGallery',
      title: 'Galeria zdjęć marki',
      type: 'array',
      description:
        'Dodaj zdjęcia do galerii marki (opcjonalne, minimum 4 zdjęcia jeśli dodajesz)',
      group: GROUP.MAIN_CONTENT,
      of: [{ type: 'image' }],
      validation: (Rule) =>
        Rule.custom((value) => {
          if (
            value &&
            Array.isArray(value) &&
            value.length > 0 &&
            value.length < 4
          ) {
            return 'Galeria musi zawierać minimum 4 zdjęcia';
          }
          return true;
        }),
    }),
    defineField({
      name: 'featuredReviews',
      title: 'Wyróżnione recenzje',
      type: 'array',
      description: 'Wybierz recenzje związane z tą marką (maksymalnie 10)',
      group: GROUP.MAIN_CONTENT,
      of: [
        {
          type: 'reference',
          to: [{ type: 'review' }],
        },
      ],
      validation: (Rule) => Rule.max(10).error('Maksymalnie 10 recenzji'),
    }),
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: 'name',
      logo: 'logo',
      description: 'description',
    },
    prepare: ({ name, logo, description }) => ({
      title: name || 'Marka',
      subtitle: toPlainText(description) || 'Marka produktów audio',
      media: logo || Tag,
    }),
  },
});
