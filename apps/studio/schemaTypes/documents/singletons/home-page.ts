import { Home } from 'lucide-react';
import { defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../utils/define-slug-for-document';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const homePage = defineType({
  name: 'homePage',
  type: 'document',
  title: 'Strona główna',
  icon: Home,
  description:
    'To tutaj tworzysz główną stronę, którą widzą odwiedzający, gdy po raz pierwszy przychodzą na Twoją stronę internetową. Pomyśl o tym jak o drzwiach wejściowych do Twojego internetowego domu - możesz dodać przyjazny tytuł, krótki opis i zbudować stronę z różnymi sekcjami jak obrazy, tekst i przyciski.',
  groups: GROUPS,
  fields: [
    ...defineSlugForDocument({
      slug: '/',
      group: GROUP.MAIN_CONTENT,
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
      media: Home,
      subtitle: description || 'Strona główna',
    }),
  },
});
