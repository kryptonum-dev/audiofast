import { FolderTree } from 'lucide-react';
import { defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const productCategories = defineType({
  name: 'productCategories',
  type: 'document',
  title: 'Strona kategorii',
  icon: FolderTree,
  groups: GROUPS,
  description:
    'Strona z kategoriami produktów audio. Skonfiguruj treść strony, na której będą wyświetlane wszystkie kategorie produktów.',
  fields: [
    ...defineSlugForDocument({
      slug: '/kategorie/',
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
      title: name || 'Kategorie produktów',
      media: FolderTree,
      subtitle: description || 'Strona kategorii',
    }),
  },
});
