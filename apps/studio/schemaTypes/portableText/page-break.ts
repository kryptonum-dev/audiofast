import { SplitHorizontalIcon } from '@sanity/icons/SplitHorizontal';
import { defineField, defineType } from 'sanity';

export const ptPageBreak = defineType({
  name: 'ptPageBreak',
  type: 'object',
  title: 'Podział kolumn',
  icon: SplitHorizontalIcon,
  description:
    'Dzieli część opisu na dwie kolumny. Treść nad nim trafia do lewej kolumny, treść pod nim do prawej, aż do „Nowej sekcji” albo końca opisu.',
  fields: [
    defineField({
      name: 'style',
      title: 'Styl',
      type: 'string',
      initialValue: 'columnBreak',
      hidden: true,
      readOnly: true,
    }),
  ],
  preview: {
    prepare: () => ({
      title: 'Podział kolumn',
      subtitle: 'Wyżej lewa kolumna, niżej prawa',
      media: SplitHorizontalIcon,
    }),
  },
});
