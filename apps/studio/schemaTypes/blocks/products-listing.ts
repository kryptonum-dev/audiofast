import { LayoutList } from "lucide-react";
import { defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Lista produktów";

export const productsListing = defineType({
  name: "productsListing",
  icon: LayoutList,
  type: "object",
  title,
  description:
    "Sekcja z pełną listą produktów z filtrowaniem, sortowaniem i paginacją.",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      description: "Główny nagłówek sekcji",
      type: "heading",
    }),
  ],
  preview: {
    select: {
      heading: "heading",
    },
    prepare: ({ heading }) => {
      return {
        title,
        subtitle: toPlainText(heading) || "Lista produktów",
        media: LayoutList,
      };
    },
  },
});
