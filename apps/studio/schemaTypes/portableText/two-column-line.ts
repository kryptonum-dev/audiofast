import { SplitHorizontalIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const ptTwoColumnLine = defineType({
  name: 'ptTwoColumnLine',
  type: 'object',
  title: 'Granica sekcji dwukolumnowej',
  icon: SplitHorizontalIcon,
  description:
    'Oznacza przejście między układem jednokolumnowym a dwukolumnowym. Użyj PRZED sekcją dwukolumnową (jeśli poprzedza ją tekst jednokolumnowy) lub PO niej (jeśli następuje po niej tekst jednokolumnowy). Nie potrzebne jeśli treść zaczyna lub kończy się sekcją dwukolumnową.',
  fields: [
    defineField({
      name: 'style',
      title: 'Styl',
      type: 'string',
      initialValue: 'twoColumnLine',
      hidden: true,
      readOnly: true,
    }),
  ],
  preview: {
    prepare: () => ({
      title: '══ Granica sekcji dwukolumnowej ══',
      subtitle: 'Przejście między układem 1-kolumnowym a 2-kolumnowym',
      media: SplitHorizontalIcon,
    }),
  },
});
