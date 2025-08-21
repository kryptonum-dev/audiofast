import { defineField, defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../utils/define-slug-for-document';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';
import { FileArchive } from 'lucide-react';

export const termsAndConditions = defineType({
  name: 'termsAndConditions',
  type: 'document',
  title: 'Regulamin',
  icon: FileArchive,
  description:
    'Strona regulaminu określa zasady korzystania z Twojej strony internetowej lub usług. Zawiera warunki użytkowania, które użytkownicy muszą zaakceptować.',
  groups: GROUPS,
  fields: [
    ...defineSlugForDocument({
      slug: '/regulamin',
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
      title: name || 'Regulamin',
      media: FileArchive,
      subtitle: description || 'Regulamin',
    }),
  },
});
