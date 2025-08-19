import { HomeIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { createSlug } from '../../../utils/slug';
import { createSlugValidator } from '../../../utils/slug-validation';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

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
      name: 'name',
      type: 'string',
      title: 'Nazwa',
      description:
        'Nazwa dokumentu, używana do wyświetlania w ścieżce nawigacyjnej.',
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) => Rule.required().error('Nazwa strony jest wymagana'),
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
          })
        ),
    }),
    pageBuilderField,
    ...getSEOFields({ exclude: ['doNotIndex', 'hideFromList'] }),
  ],
  preview: {
    select: {
      name: 'name',
      description: 'description',
      slug: 'slug.current',
    },
    prepare: ({ name, description }) => ({
      title: name || 'Strona główna',
      media: HomeIcon,
      subtitle: description || 'Strona główna',
    }),
  },
});
