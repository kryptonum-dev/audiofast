import { StackIcon } from "@sanity/icons";
import { Columns2 } from "lucide-react";
import { defineField, defineType } from "sanity";

import { customPortableText } from "./index";

export const ptTwoColumnTable = defineType({
  name: "ptTwoColumnTable",
  type: "object",
  title: "Tabela dwukolumnowa",
  icon: StackIcon,
  fields: [
    defineField({
      name: "rows",
      title: "Wiersze tabeli",
      type: "array",
      description: "Dodaj wiersze tabeli z dwoma kolumnami",
      of: [
        {
          type: "object",
          icon: Columns2,
          fields: [
            defineField({
              name: "column1",
              title: "Pierwsza kolumna",
              type: "string",
              description: "Zawartość pierwszej kolumny",
              validation: (Rule) =>
                Rule.required().error("Pierwsza kolumna jest wymagana"),
            }),
            customPortableText({
              name: "column2",
              title: "Druga kolumna",
              description: "Zawartość drugiej kolumny (z formatowaniem)",
              include: {
                styles: ["normal"],
                lists: [],
                decorators: ["strong", "em"],
                annotations: ["customLink"],
              },
            }),
          ],
          preview: {
            select: {
              column1: "column1",
              column2: "column2",
            },
            prepare: ({ column1, column2 }) => {
              const column2Text =
                column2?.[0]?.children?.[0]?.text || "Brak wartości";
              return {
                title: column1 || "Pusty wiersz",
                subtitle: column2Text,
                media: Columns2,
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.required().min(1).error("Dodaj przynajmniej jeden wiersz"),
    }),
  ],
  preview: {
    select: {
      rows: "rows",
    },
    prepare: ({ rows }) => {
      const count = rows?.length || 0;
      return {
        title: `Tabela dwukolumnowa`,
        subtitle: `${count} ${count === 1 ? "wiersz" : count < 5 ? "wiersze" : "wierszy"}`,
        media: StackIcon,
      };
    },
  },
});
