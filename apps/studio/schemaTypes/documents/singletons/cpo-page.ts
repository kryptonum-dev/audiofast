import { Speaker } from 'lucide-react';
import { defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { cpoPageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';


const title = 'Strona CPO';

export const cpoPage = defineType({
  name: 'cpoPage',
  type: 'document',
  title,
  icon: Speaker,
  description:
    'Strona dla certyfikowanego sprzętu używanego (CPO). Tutaj możesz zarządzać treścią strony prezentującej produkty CPO.',
  groups: GROUPS,
  fields: [
    ...defineSlugForDocument({
      slug: '/certyfikowany-sprzet-uzywany/',
      group: GROUP.MAIN_CONTENT,
    }),
    cpoPageBuilderField,
    ...getSEOFields({ exclude: ['hideFromList'] }),
  ],
  preview: {
    prepare: () => ({
      title,
      media: Speaker,
    }),
  },
});
