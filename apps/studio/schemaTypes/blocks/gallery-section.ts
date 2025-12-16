import { Images } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Galeria obrazów";

export const gallerySection = defineType({
  name: "gallerySection",
  title,
  icon: Images,
  type: "object",
  description: "Sekcja prezentująca galerię zdjęć w układzie siatki",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      description: "Główny nagłówek sekcji galerii",
      type: "heading",
    }),
    customPortableText({
      name: "description",
      title: "Opis sekcji",
      description: "Krótki opis galerii wyświetlany pod nagłówkiem",
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    defineField({
      name: "images",
      title: "Zdjęcia galerii",
      type: "array",
      description: "Dodaj od 4 do 12 zdjęć do galerii",
      of: [
        {
          type: "image",
          options: {
            hotspot: true,
          },
        },
      ],
      validation: (Rule) => [
        Rule.min(4).error("Galeria musi zawierać minimum 4 zdjęcia"),
        Rule.max(12).error("Galeria może zawierać maksymalnie 12 zdjęć"),
        Rule.required().error("Dodaj zdjęcia do galerii"),
      ],
    }),
  ],
  preview: {
    select: {
      heading: "heading",
    },
    prepare: ({ heading }) => {
      return {
        title,
        subtitle: toPlainText(heading),
        media: Images,
      };
    },
  },
});
