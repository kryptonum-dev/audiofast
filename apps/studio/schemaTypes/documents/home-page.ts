import { HomeIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

import { GROUP, GROUPS } from '../../utils/constant';
import { createSlug } from '../../utils/slug';
import { createSlugValidator } from '../../utils/slug-validation';
import { pageBuilderField } from '../shared';
import { ogFields, seoFields } from '../shared/seo';

export const homePage = defineType({
  name: 'homePage',
  type: 'document',
  title: 'Strona główna',
  icon: HomeIcon,
  description:
    'To tutaj tworzysz główną stronę, którą widzą odwiedzający, gdy po raz pierwszy przychodzą na Twoją stronę internetową. Pomyśl o tym jak o drzwiach wejściowych do Twojego internetowego domu - możesz dodać przyjazny tytuł, krótki opis i zbudować stronę z różnymi sekcjami jak obrazy, tekst i przyciski.',
  groups: GROUPS,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      description:
        'Główny nagłówek, który pojawi się na górze Twojej strony głównej',
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'description',
      title: 'Opis',
      type: 'text',
      description:
        'Krótkie podsumowanie, które mówi odwiedzającym, o czym jest Twoja strona internetowa. Ten tekst również pomaga Twojej stronie pojawiać się w wyszukiwaniach Google.',
      rows: 3,
      group: GROUP.MAIN_CONTENT,
      validation: (rule) => [
        rule
          .min(140)
          .warning(
            'Meta opis powinien mieć co najmniej 140 znaków dla optymalnej widoczności SEO w wynikach wyszukiwania',
          ),
        rule
          .max(160)
          .warning(
            'Meta opis nie powinien przekraczać 160 znaków, ponieważ zostanie obcięty w wynikach wyszukiwania',
          ),
      ],
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      description:
        "Adres internetowy Twojej strony głównej. Zwykle to jest po prostu '/' dla głównej strony Twojej witryny.",
      group: GROUP.MAIN_CONTENT,
      options: {
        source: 'title',
        slugify: createSlug,
      },
      validation: (Rule) =>
        Rule.required().custom(
          createSlugValidator({
            documentType: 'Strona główna',
            requiredPrefix: '/',
          }),
        ),
    }),
    pageBuilderField,
    ...seoFields.filter(
      (field) => !['seoNoIndex', 'seoHideFromLists'].includes(field.name),
    ),
    ...ogFields,
  ],
  preview: {
    select: {
      title: 'title',
      description: 'description',
      slug: 'slug.current',
    },
    prepare: ({ title, description, slug }) => ({
      title: title || 'Untitled Home Page',
      media: HomeIcon,
      subtitle: slug || 'Home Page',
    }),
  },
});
