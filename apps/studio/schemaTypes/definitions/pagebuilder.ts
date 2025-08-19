import { defineArrayMember, defineType } from 'sanity';

import { pageBuilderBlocks } from '../blocks';

export const pagebuilderBlockTypes = pageBuilderBlocks.map(({ name }) => ({
  type: name,
}));

export const pageBuilder = defineType({
  name: 'pageBuilder',
  type: 'array',
  of: pagebuilderBlockTypes.map((block) => defineArrayMember(block)),
  options: {
    insertMenu: {
      filter: true,
      showIcons: true,
      views: [
        {
          name: 'grid',
          previewImageUrl: (schemaTypeName) =>
            `/static/components/${schemaTypeName}.webp`,
        },
        { name: 'list' },
      ],
    },
  },
});
