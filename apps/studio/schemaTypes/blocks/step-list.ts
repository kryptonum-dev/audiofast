import { ListOrdered } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Lista kroków";

export const stepList = defineType({
  name: "stepList",
  icon: ListOrdered,
  type: "object",
  title,
  description:
    "Sekcja przedstawiająca proces w formie ponumerowanych kroków z nagłówkami i opisami",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      type: "heading",
    }),
    customPortableText({
      name: "paragraph",
      title: "Paragraf opisowy",
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    defineField({
      name: "steps",
      title: "Lista kroków",
      type: "array",
      description:
        "Lista kroków procesu. Możesz dodać od 4 do 8 kroków. Każdy krok będzie automatycznie ponumerowany.",
      of: [
        {
          type: "object",
          name: "step",
          title: "Krok",
          icon: ListOrdered,
          fields: [
            customPortableText({
              name: "heading",
              title: "Nagłówek kroku",
              description: "Tytuł tego kroku procesu",
              type: "heading",
            }),
            customPortableText({
              name: "description",
              title: "Opis kroku",
              description: "Szczegółowy opis tego kroku procesu",
              include: {
                styles: ["normal"],
                decorators: ["strong", "em"],
                annotations: ["customLink"],
              },
            }),
          ],
          preview: {
            select: {
              heading: "heading",
              description: "description",
            },
            prepare: ({ heading, description }) => {
              return {
                title: toPlainText(heading),
                subtitle: toPlainText(description),
                media: ListOrdered,
              };
            },
          },
        },
      ],
      validation: (Rule) => [
        Rule.min(4).error("Musisz dodać minimum 4 kroki"),
        Rule.max(8).error("Możesz dodać maksymalnie 8 kroków"),
        Rule.required().error("Lista kroków jest wymagana"),
      ],
    }),
  ],
  preview: {
    select: {
      heading: "heading",
      paragraph: "paragraph",
      steps: "steps",
    },
    prepare: ({ heading }) => {
      return {
        title,
        subtitle: toPlainText(heading),
        media: ListOrdered,
      };
    },
  },
});
