import { Lock } from 'lucide-react';
import { defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { customPortableText } from '../../portableText';
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
      slug: '/polityka-prywatnosci/',
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: 'description',
      title: 'Opis',
      description: 'Krótki opis polityki prywatności pod nagłówkiem strony',
      group: GROUP.MAIN_CONTENT,
      include: {
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
    }),
    customPortableText({
      name: 'content',
      title: 'Treść',
      description: 'Treść polityki prywatności',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal', 'h2', 'h3'],
        lists: ['bullet', 'number'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
    }),
    ...getSEOFields({ exclude: ['doNotIndex', 'hideFromList'] }),
  ],
  preview: {
    select: {
      name: 'name',
      slug: 'slug.current',
    },
    prepare: ({ name }) => ({
      title: name || 'Polityka prywatności',
      media: Lock,
    }),
  },
});
