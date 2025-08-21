import { BrickWallShield, Package } from 'lucide-react';
import { defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../utils/define-slug-for-document';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const products = defineType({
  name: 'products',
  type: 'document',
  title: 'Strona produktów',
  icon: BrickWallShield,
  groups: GROUPS,
  description:
    'Strona z produktami audio. Skonfiguruj treść strony, na której będą wyświetlane wszystkie produkty audio.',
  fields: [
    ...defineSlugForDocument({
      slug: '/produkty/',
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
      title: name || 'Produkty',
      media: Package,
      subtitle: description || 'Strona produktów',
    }),
  },
});
