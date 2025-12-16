import { List } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Marki według kategorii";

export const brandsByCategoriesSection = defineType({
  name: "brandsByCategoriesSection",
  icon: List,
  type: "object",
  title,
  description:
    "Sekcja wyświetlająca marki pogrupowane według kategorii nadrzędnych produktów. Kategorie z produktami są wyświetlane jako rozwijane listy z markami.",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      description: "Główny nagłówek sekcji",
      type: "heading",
    }),
    customPortableText({
      name: "description",
      title: "Opis sekcji",
      description:
        "Tekst opisowy wyświetlany pod nagłówkiem, wyjaśniający informacje o markach według kategorii.",
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    defineField({
      name: "button",
      title: "Przycisk CTA",
      type: "buttonWithNoVariant",
      description:
        'Przycisk zachęcający do akcji (np. "Skontaktuj się z nami")',
      validation: (Rule) => Rule.required().error("Przycisk CTA jest wymagany"),
    }),
  ],
  preview: {
    select: {
      heading: "heading",
      description: "description",
    },
    prepare: ({ heading, description }) => {
      return {
        title,
        subtitle:
          toPlainText(heading) ||
          toPlainText(description) ||
          "Marki według kategorii",
        media: List,
      };
    },
  },
});
