import { ImageIcon } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

export const blurLinesTextImage = defineType({
  name: "blurLinesTextImage",
  title: "Tekst z obrazem i rozmytymi liniami",
  icon: ImageIcon,
  type: "object",
  description:
    "Sekcja z tekstem po lewej stronie i obrazem po prawej z dekoracyjnymi rozmytymi liniami",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek",
      description: "Główny nagłówek sekcji",
      type: "heading",
    }),
    customPortableText({
      name: "description",
      title: "Opis",
      description:
        "Główna treść sekcji z możliwością dodania podtytułów i formatowania",
      include: {
        styles: ["normal", "h3"],
        lists: ["bullet"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    defineField({
      name: "image",
      title: "Zdjęcie",
      type: "image",
      description: "Zdjęcie wyświetlane po prawej stronie sekcji",
      options: {
        hotspot: true,
      },
      validation: (Rule) => Rule.required().error("Zdjęcie jest wymagane"),
    }),
  ],
  preview: {
    select: {
      heading: "heading",
    },
    prepare: ({ heading }) => {
      return {
        title: "Tekst z obrazem i rozmytymi liniami",
        subtitle: toPlainText(heading),
        media: ImageIcon,
      };
    },
  },
});
