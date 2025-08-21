import { defineField, defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../utils/define-slug-for-document';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';
import { BookOpen } from 'lucide-react';

export const blog = defineType({
  name: 'blog',
  type: 'document',
  title: 'Blog',
  icon: BookOpen,
  groups: GROUPS,
  fields: [
    ...defineSlugForDocument({
      slug: '/blog/',
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
      title: name || 'Blog',
      media: BookOpen,
      subtitle: description || 'Blog',
    }),
  },
});
