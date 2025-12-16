import { LayoutList } from "lucide-react";
import { defineField, defineType } from "sanity";

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
    defineField({
      name: "cpoOnly",
      title: "Tylko produkty CPO",
      type: "boolean",
      description:
        "Jeśli zaznaczone, wyświetlane będą tylko produkty certyfikowane (CPO)",
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      heading: "heading",
      cpoOnly: "cpoOnly",
    },
    prepare: ({ heading, cpoOnly }) => {
      const modeLabel = cpoOnly ? "Tylko produkty CPO" : "Wszystkie produkty";
      return {
        title,
        subtitle: `${toPlainText(heading)} | ${modeLabel}`,
        media: LayoutList,
      };
    },
  },
});
