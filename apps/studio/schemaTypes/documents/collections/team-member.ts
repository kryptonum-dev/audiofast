import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { Users } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { customPortableText } from '../../portableText';

export const teamMember = defineType({
  name: 'teamMember',
  title: 'Członek zespołu',
  type: 'document',
  icon: Users,
  orderings: [orderRankOrdering],
  description:
    'Członek zespołu Audiofast. Dodaj zdjęcie, imię i nazwisko, stanowisko oraz informacje kontaktowe.',
  fields: [
    orderRankField({ type: 'teamMember' }),
    defineField({
      name: 'name',
      title: 'Imię i nazwisko',
      type: 'string',
      description: 'Pełne imię i nazwisko członka zespołu',
      validation: (Rule) =>
        Rule.required().error('Imię i nazwisko jest wymagane'),
    }),
    defineField({
      name: 'position',
      title: 'Stanowisko',
      type: 'string',
      validation: (Rule) => Rule.required().error('Stanowisko jest wymagane'),
    }),
    defineField({
      name: 'image',
      title: 'Zdjęcie',
      type: 'image',
      validation: (Rule) => Rule.required().error('Zdjęcie jest wymagane'),
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'phoneNumber',
      title: 'Numer telefonu',
      description: 'Numer telefonu w formacie +48 XXX XXX XXX',
      type: 'string',
      validation: (Rule) =>
        Rule.required().error('Numer telefonu jest wymagany'),
    }),
    customPortableText({
      name: 'description',
      title: 'Opis',
      description:
        'Krótki opis członka zespołu, jego doświadczenia i specjalizacji',
      include: {
        styles: ['normal'],
        decorators: ['strong', 'em'],
        annotations: [],
        lists: [],
      },
      validation: (Rule) =>
        Rule.required().error('Opis członka zespołu jest wymagany'),
    }),
  ],
  preview: {
    select: {
      name: 'name',
      position: 'position',
      phoneNumber: 'phoneNumber',
      image: 'image',
    },
    prepare: ({ name, position, phoneNumber, image }) => ({
      title: name || 'Członek zespołu',
      subtitle: `${position} (${phoneNumber})`,
      media: image || Users,
    }),
  },
});
