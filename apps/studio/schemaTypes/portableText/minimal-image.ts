import { ImageIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

export const ptMinimalImage = defineType({
  name: "ptMinimalImage",
  type: "object",
  title: "Minimalny obraz",
  icon: ImageIcon,
  description: "Pojedynczy obraz bez podpisu",
  fields: [
    defineField({
      name: "image",
      title: "Zdjęcie",
      type: "image",
      options: { hotspot: true },
      validation: (Rule) => Rule.required().error("Zdjęcie jest wymagane"),
    }),
  ],
  preview: {
    select: {
      image: "image",
    },
    prepare: ({ image }) => ({
      title: "Minimalny obraz",
      media: image || ImageIcon,
    }),
  },
});
