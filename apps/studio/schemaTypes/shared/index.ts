import { defineField } from 'sanity';

import { GROUP } from '../../utils/constant';
import { customPortableText } from '../definitions/portable-text';

export const portableTextField = customPortableText({
  name: 'portableText',
  description:
    'Edytor tekstu, który pozwala dodawać formatowanie, takie jak pogrubiony tekst, linki i punktory',
});

export const buttonsField = defineField({
  name: 'buttons',
  type: 'array',
  title: 'Przyciski',
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

export { contactPersonField } from './contact-person';
