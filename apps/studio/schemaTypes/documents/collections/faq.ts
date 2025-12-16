import { MessageCircleQuestion } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../../utils/helper";
import { customPortableText } from "../../portableText";

export const faq = defineType({
  name: "faq",
  type: "document",
  title: "Element FAQ",
  description:
    "Prosta para pytanie-odpowiedź, która pomaga odwiedzającym szybko znaleźć informacje. Pomyśl o tym jak o zapisywaniu pytań, które klienci często zadają, wraz z jasnymi odpowiedziami.",
  icon: MessageCircleQuestion,
  fields: [
    defineField({
      name: "question",
      title: "Pytanie",
      type: "text",
      rows: 2,
    }),
    customPortableText({
      name: "answer",
      title: "Odpowiedź",
    }),
  ],
  preview: {
    select: {
      question: "question",
      answer: "answer",
    },
    prepare: ({ question, answer }) => {
      return {
        title: question || "Brak pytania",
        subtitle: toPlainText(answer) || "Brak odpowiedzi",
      };
    },
  },
});
