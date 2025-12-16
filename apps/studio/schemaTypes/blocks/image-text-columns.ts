import { Columns } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

export const imageTextColumns = defineType({
  name: "imageTextColumns",
  title: "Obraz i tekst w kolumnach",
  icon: Columns,
  type: "object",
  description:
    "Sekcja dwukolumnowa z obrazem po lewej stronie i tekstem z przyciskiem po prawej",
  fields: [
    defineField({
      name: "image",
      title: "Zdjęcie",
      type: "image",
      description: "Zdjęcie wyświetlany po lewej stronie sekcji",
      options: {
        hotspot: true,
      },
      validation: (Rule) => Rule.required().error("Zdjęcie jest wymagane"),
    }),
    customPortableText({
      name: "heading",
      title: "Nagłówek",
      description: "Główny nagłówek sekcji",
      type: "heading",
    }),
    customPortableText({
      name: "content",
      title: "Treść",
      description:
        "Główna treść sekcji z możliwością dodania list, formatowania i linków",
      include: {
        styles: ["normal", "h3"],
        lists: ["bullet", "number"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    defineField({
      name: "button",
      title: "Przycisk CTA",
      type: "buttonWithNoVariant",
      description: "Przycisk wezwania do działania",
      validation: (Rule) => Rule.required().error("Przycisk jest wymagany"),
    }),
  ],
  preview: {
    select: {
      heading: "heading",
    },
    prepare: ({ heading }) => {
      return {
        title: "Obraz i tekst w kolumnach",
        subtitle: toPlainText(heading),
        media: Columns,
      };
    },
  },
});
