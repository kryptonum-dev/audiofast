import { SplitHorizontalIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const ptPageBreak = defineType({
  name: 'ptPageBreak',
  type: 'object',
  title: 'Podział: lewa | prawa kolumna',
  icon: SplitHorizontalIcon,
  description:
    'Rozdziela lewą i prawą kolumnę. Treść nad nim trafia do lewej kolumny, treść pod nim do prawej, aż do znacznika „Przejście 1 ↔ 2 kolumny” albo końca opisu.',
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
      title: 'Podział: lewa | prawa kolumna',
      subtitle:
        'Wyżej lewa kolumna, niżej prawa (do „Przejścia 1 ↔ 2 kolumny” albo końca opisu)',
      media: SplitHorizontalIcon,
    }),
  },
});
