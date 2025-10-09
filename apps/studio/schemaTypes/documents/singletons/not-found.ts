import { AlertTriangle } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { toPlainText } from '../../../utils/helper';
import { customPortableText } from '../../definitions/portable-text';
import { getSEOFields } from '../../shared/seo';

const title = 'Nie znaleziono strony (404)';

export const notFound = defineType({
  name: 'notFound',
  type: 'document',
  title,
  icon: AlertTriangle,
  description:
    'Strona błędu 404, która wyświetla się, gdy użytkownik próbuje odwiedzić stronę, która nie istnieje. Pomaga użytkownikom wrócić na właściwą ścieżkę na Twojej stronie.',
  groups: GROUPS,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      title: 'Nazwa',
      group: GROUP.MAIN_CONTENT,
      description:
        'Nazwa dokumentu, używana do wyświetlania w ścieżce nawigacyjnej.',
      validation: (Rule) => Rule.required().error('Nazwa jest wymagana'),
    }),
    defineField({
      name: 'backgroundImage',
      title: 'Obrazek tła "404"',
      description:
        'Obrazek wyświetlany jako tło dużego tekstu "404". Będzie widoczny przez półprzezroczysty tekst, tworząc efekt tekstury.',
      type: 'image',
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) =>
        Rule.required().error('Obrazek tła "404" jest wymagany'),
    }),
    customPortableText({
      name: 'heading',
      title: 'Nagłówek',
      description:
        'Główny nagłówek strony 404, np. "Strona nie została odnaleziona"',
      group: GROUP.MAIN_CONTENT,
      type: 'heading',
    }),
    customPortableText({
      name: 'description',
      title: 'Opis',
      description:
        'Krótki opis informujący użytkownika o błędzie i co może zrobić dalej',
      group: GROUP.MAIN_CONTENT,
      optional: true,
    }),
    defineField({
      name: 'buttons',
      title: 'Przyciski CTA',
      description:
        'Dodaj 1-2 przyciski, które pomogą użytkownikowi nawigować z powrotem na stronę (np. "Zobacz produkty", "Wróć na stronę główną")',
      type: 'array',
      group: GROUP.MAIN_CONTENT,
      of: [{ type: 'button' }],
      validation: (Rule) =>
        Rule.min(1)
          .error('Minimum 1 przycisk')
          .max(2)
          .error('Maksimum 2 przyciski')
          .required()
          .error('Przyciski są wymagane'),
    }),
    ...getSEOFields({ exclude: ['doNotIndex', 'hideFromList'] }),
  ],
  preview: {
    select: {
      heading: 'heading',
    },
    prepare: ({ heading }) => ({
      title: title,
      media: AlertTriangle,
      subtitle: toPlainText(heading),
    }),
  },
});
