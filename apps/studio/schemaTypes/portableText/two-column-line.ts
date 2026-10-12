import { SplitHorizontalIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const ptTwoColumnLine = defineType({
  name: 'ptTwoColumnLine',
  type: 'object',
  title: 'Przejście 1 ↔ 2 kolumny',
  icon: SplitHorizontalIcon,
  description:
    'Przełącza układ między jedną a dwiema kolumnami. Wstaw za treścią prawej kolumny, żeby dalszy tekst wyświetlał się w jednej kolumnie. Wstaw przed treścią lewej kolumny, jeśli nad sekcją dwukolumnową jest tekst w jednej kolumnie (bez tego trafi on do lewej kolumny).',
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
      title: 'Przejście 1 ↔ 2 kolumny',
      subtitle:
        'Za prawą kolumną: powrót do 1 kolumny. Przed lewą kolumną: start 2 kolumn.',
      media: SplitHorizontalIcon,
    }),
  },
});
