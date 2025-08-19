import { defineField } from 'sanity';

import { GROUP } from '../../utils/constant';

export const portableTextField = defineField({
  name: 'portableText',
  type: 'portableText',
  description:
    'Edytor tekstu, który pozwala dodawać formatowanie, takie jak pogrubiony tekst, linki i punktory',
});

export const buttonsField = defineField({
  name: 'buttons',
  type: 'array',
  of: [{ type: 'button' }],
  description:
    'Dodaj jeden lub więcej klikanych przycisków, których odwiedzający mogą używać do nawigacji po Twojej stronie',
});

export const pageBuilderField = defineField({
  name: 'pageBuilder',
  group: GROUP.MAIN_CONTENT,
  type: 'pageBuilder',
  description:
    'Zbuduj swoją stronę, dodając różne sekcje, takie jak tekst, obrazy i inne bloki treści',
});
