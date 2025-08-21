import { Lock } from 'lucide-react';
import { defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../utils/define-slug-for-document';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const privacyPolicy = defineType({
  name: 'privacyPolicy',
  type: 'document',
  title: 'Polityka prywatności',
  icon: Lock,
  description:
    'Strona polityki prywatności opisuje, jak zbierasz, używasz i chronisz dane osobowe użytkowników. Jest to strona wymagana prawnie dla większości stron internetowych.',
  groups: GROUPS,
  fields: [
    ...defineSlugForDocument({
      slug: '/polityka-prywatnosci',
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
      title: name || 'Polityka prywatności',
      media: Lock,
      subtitle: description || 'Polityka prywatności',
    }),
  },
});
