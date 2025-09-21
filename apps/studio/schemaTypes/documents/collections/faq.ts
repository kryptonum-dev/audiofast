import { MessageCircleQuestion } from 'lucide-react';
import { defineType } from 'sanity';

import { toPlainText } from '../../../utils/helper';
import { customPortableText } from '../../definitions/portable-text';

export const faq = defineType({
  name: 'faq',
  type: 'document',
  title: 'Element FAQ',
  description:
    'Prosta para pytanie-odpowiedź, która pomaga odwiedzającym szybko znaleźć informacje. Pomyśl o tym jak o zapisywaniu pytań, które klienci często zadają, wraz z jasnymi odpowiedziami.',
  icon: MessageCircleQuestion,
  fields: [
    customPortableText({
      name: 'title',
      title: 'Pytanie',
      description:
        "Napisz pytanie dokładnie tak, jak ktoś mógłby je zadać. Na przykład: 'Jak mogę zresetować swoje hasło?'",
      type: 'heading',
    }),
    customPortableText({
      name: 'answer',
      title: 'Odpowiedź',
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
