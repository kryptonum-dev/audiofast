import { MessageCircleQuestion } from "lucide-react";
import { defineField, defineType } from "sanity";

import { parsePortableTextToString } from "../../utils/helper";
import { portableTextField } from "../shared";

export const faq = defineType({
  name: "faq",
  type: "document",
  title: "Najczęściej zadawane pytanie",
  description:
    "Prosta para pytanie-odpowiedź, która pomaga odwiedzającym szybko znaleźć informacje. Pomyśl o tym jak o zapisywaniu pytań, które klienci często zadają, wraz z jasnymi odpowiedziami.",
  icon: MessageCircleQuestion,
  fields: [
    defineField({
      name: "title",
      title: "Pytanie",
      type: "string",
      description:
        "Napisz pytanie dokładnie tak, jak ktoś mógłby je zadać. Na przykład: 'Jak mogę zresetować swoje hasło?'",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      ...portableTextField,
      title: "Odpowiedź",
      description:
        "Napisz przyjazną, jasną odpowiedź, która bezpośrednio odnosi się do pytania. Utrzymuj ją na tyle prostą, żeby każdy mógł ją zrozumieć.",
    }),
  ],
  preview: {
    select: {
      title: "title",
      portableText: "portableText",
    },
    prepare: ({ title, portableText }) => {
      // Create a playful subtitle with emojis
      const subtitle = `${parsePortableTextToString(portableText, 20)}`;

      return {
        title: `❓ ${title || "Nie ma tytułu"}`,
        subtitle,
      };
    },
  },
});
