import { ImageIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

/**
 * Inline Image - floats left or right within text content
 * Used for images that should have text wrap around them
 */
export const ptInlineImage = defineType({
  name: "ptInlineImage",
  type: "object",
  title: "Obrazek w tekście",
  icon: ImageIcon,
  description: "Obrazek osadzony w tekście z opływaniem (float left/right)",
  fields: [
    defineField({
      name: "image",
      title: "Obrazek",
      type: "image",
      options: {
        hotspot: true,
      },
      validation: (Rule) => Rule.required().error("Obrazek jest wymagany"),
    }),
    defineField({
      name: "float",
      title: "Pozycja",
      type: "string",
      description: "Wybierz, po której stronie ma być obrazek",
      options: {
        list: [
          { title: "Po lewej (tekst opływa z prawej)", value: "left" },
          { title: "Po prawej (tekst opływa z lewej)", value: "right" },
        ],
        layout: "radio",
      },
      initialValue: "left",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "alt",
      title: "Tekst alternatywny",
      type: "string",
      description: "Opis obrazka dla dostępności i SEO",
    }),
    defineField({
      name: "width",
      title: "Szerokość (px)",
      type: "number",
      description:
        "Opcjonalna stała szerokość obrazka w pikselach. Jeśli nie podano, używana jest domyślna szerokość.",
      validation: (Rule) => Rule.min(20).max(600),
    }),
  ],
  preview: {
    select: {
      image: "image",
      float: "float",
      alt: "alt",
    },
    prepare: ({ image, float, alt }) => ({
      title: alt || "Obrazek w tekście",
      subtitle: float === "left" ? "← Float lewo" : "Float prawo →",
      media: image || ImageIcon,
    }),
  },
});
