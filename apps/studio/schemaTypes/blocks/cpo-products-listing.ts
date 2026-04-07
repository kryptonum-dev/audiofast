import { LayoutList } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Lista produktów CPO";

export const cpoProductsListing = defineType({
  name: "cpoProductsListing",
  icon: LayoutList,
  type: "object",
  title,
  description:
    "Sekcja z listą produktów certyfikowanych (CPO). Wyświetla tylko egzemplarze z programu CPO.",
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
    prepare: ({ heading }) => ({
      title,
      subtitle: toPlainText(heading) || "Lista produktów CPO",
      media: LayoutList,
    }),
  },
});
