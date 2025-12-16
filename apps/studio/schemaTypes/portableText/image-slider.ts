import { ImagesIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

export const ptImageSlider = defineType({
  name: "ptImageSlider",
  type: "object",
  title: "Galeria zdjęć",
  icon: ImagesIcon,
  fields: [
    defineField({
      name: "images",
      title: "Zdjęcia",
      type: "array",
      description: "Dodaj zdjęcia do galerii (minimum 4)",
      of: [
        {
          type: "image",
          options: { hotspot: true },
        },
      ],
      validation: (Rule) =>
        Rule.required()
          .min(4)
          .error("Galeria musi zawierać co najmniej 4 zdjęcia"),
    }),
  ],

  preview: {
    select: {
      images: "images",
    },
    prepare: ({ images }) => {
      const imageCount = images?.length ?? 0;

      // Helper for proper plural forms in Polish
      const getPolishPhotoWord = (count: number) => {
        if (count === 1) return "zdjęcie";
        if (count === 0) return "zdjęć";
        if (count % 100 >= 12 && count % 100 <= 14) return "zdjęć";
        const mod10 = count % 10;
        if (mod10 >= 2 && mod10 <= 4) return "zdjęcia";
        return "zdjęć";
      };

      return {
        title: `Galeria zdjęć (${imageCount} ${getPolishPhotoWord(imageCount)})`,
        media: images?.[0],
      };
    },
  },
});
