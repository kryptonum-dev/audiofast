import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { MapPin } from 'lucide-react';
import { defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { getSEOFields } from '../../shared/seo';

export const store = defineType({
  name: 'store',
  title: 'Salon',
  type: 'document',
  icon: MapPin,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Salon sprzedaży produktów audio. Dodaj nazwę, adres i informacje kontaktowe salonu.',
  fields: [
    orderRankField({ type: 'stores' }),
    ...defineSlugForDocument({
      prefix: '/salony/',
      group: GROUP.MAIN_CONTENT,
    }),
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: 'name',
      description: 'description',
    },
    prepare: ({ name, description }) => ({
      title: name || 'Salon',
      media: MapPin,
      subtitle: description || 'Salon sprzedaży',
    }),
  },
});
