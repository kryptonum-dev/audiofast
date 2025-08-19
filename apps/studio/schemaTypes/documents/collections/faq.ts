import { MessageCircleQuestion } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { parsePortableTextToString, toPlainText } from '../../../utils/helper';

export const faq = defineType({
  name: 'faq',
  type: 'document',
  title: 'Najczęściej zadawane pytania',
  description:
    'Prosta para pytanie-odpowiedź, która pomaga odwiedzającym szybko znaleźć informacje. Pomyśl o tym jak o zapisywaniu pytań, które klienci często zadają, wraz z jasnymi odpowiedziami.',
  icon: MessageCircleQuestion,
  fields: [
    defineField({
      name: 'title',
      title: 'Pytanie',
      type: 'portableTextHeading',
      description:
        "Napisz pytanie dokładnie tak, jak ktoś mógłby je zadać. Na przykład: 'Jak mogę zresetować swoje hasło?'",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'answer',
      type: 'portableText',
      title: 'Odpowiedź',
      validation: (Rule) => Rule.required(),
      description:
        'Napisz przyjazną, jasną odpowiedź, która bezpośrednio odnosi się do pytania. Utrzymuj ją na tyle prostą, żeby każdy mógł ją zrozumieć.',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      answer: 'answer',
    },
    prepare: ({ title, answer }) => {
      return {
        title: toPlainText(title) || 'Brak pytania',
        subtitle: toPlainText(answer) || 'Brak odpowiedzi',
      };
    },
  },
});
