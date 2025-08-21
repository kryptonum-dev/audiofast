import { defineField, defineType } from 'sanity';
import { AlertTriangle } from 'lucide-react';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../utils/define-slug-for-document';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const notFound = defineType({
  name: 'notFound',
  type: 'document',
  title: 'Nie znaleziono strony (404)',
  icon: AlertTriangle,
  description:
    'Strona błędu 404, która wyświetla się, gdy użytkownik próbuje odwiedzić stronę, która nie istnieje. Pomaga użytkownikom wrócić na właściwą ścieżkę na Twojej stronie.',
  groups: GROUPS,
  fields: [
    ...defineSlugForDocument({
      slug: '/404',
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
      title: name || 'Nie znaleziono strony (404)',
      media: AlertTriangle,
      subtitle: description || 'Nie znaleziono strony (404)',
    }),
  },
});
