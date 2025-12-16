import { Zap } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Lista marek z tekstem";

export const brandsMarquee = defineType({
  name: "brandsMarquee",
  title,
  icon: Zap,
  type: "object",
  description:
    "Sekcja wyświetlająca listy marek z animowanym marquee i tekstem opisowym",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      description: "Główny nagłówek sekcji z markami",
      type: "heading",
      validation: (Rule) => Rule.required().error("Nagłówek jest wymagany"),
    }),
    customPortableText({
      name: "description",
      title: "Opis sekcji",
      description: "Tekst opisowy pod nagłówkiem",
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
        lists: ["bullet", "number"],
      },
      validation: (Rule) => Rule.required().error("Opis jest wymagany"),
    }),
    defineField({
      name: "button",
      title: "Przycisk CTA",
      type: "buttonWithNoVariant",
      description: "Przycisk wezwania do działania pod opisem",
      validation: (Rule) => Rule.required().error("Przycisk jest wymagany"),
    }),
    defineField({
      name: "backgroundImage",
      title: "Zdjęcie w tle",
      type: "image",
      description:
        "Główne zdjęcie tła sekcji (automatycznie optymalizowane dla różnych urządzeń)",
      options: {
        hotspot: true,
      },
      validation: (Rule) =>
        Rule.required().error("Zdjęcie w tle jest wymagane"),
    }),
    defineField({
      name: "topBrands",
      title: "Pierwszy rząd marek",
      type: "array",
      description:
        "Wybierz 5-10 marek do wyświetlenia w górnym rzędzie marquee (Zalecamy taką samą liczbę marek w górnym i dolnym rzędzie)",
      of: [
        {
          type: "reference",
          to: [{ type: "brand" }],
          options: {
            disableNew: true,
            filter: ({ parent }) => {
              // Prevent duplicate selections
              const selectedIds =
                (parent as { _ref?: string }[])
                  ?.filter((item) => item._ref)
                  .map((item) => item._ref) || [];

              return {
                filter: '!(_id in $selectedIds) && !(_id in path("drafts.**"))',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) => [
        Rule.min(5).error("Minimum 5 marek w górnym rzędzie"),
        Rule.max(10).error("Maksimum 10 marek w górnym rzędzie"),
        Rule.required().error("Pierwszy rząd marek jest wymagany"),
        Rule.unique().error("Marki nie mogą się powtarzać"),
      ],
    }),
    defineField({
      name: "bottomBrands",
      title: "Drugi rząd marek",
      type: "array",
      description:
        "Wybierz 5-10 marek do wyświetlenia w dolnym rzędzie marquee (Zalecamy taką samą liczbę marek w górnym i dolnym rzędzie)",
      of: [
        {
          type: "reference",
          to: [{ type: "brand" }],
          options: {
            disableNew: true,
            filter: ({ parent }) => {
              // Prevent duplicate selections
              const selectedIds =
                (parent as { _ref?: string }[])
                  ?.filter((item) => item._ref)
                  .map((item) => item._ref) || [];

              return {
                filter: '!(_id in $selectedIds) && !(_id in path("drafts.**"))',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) => [
        Rule.min(5).error("Minimum 5 marek w dolnym rzędzie"),
        Rule.max(10).error("Maksimum 10 marek w dolnym rzędzie"),
        Rule.required().error("Drugi rząd marek jest wymagany"),
        Rule.unique().error("Marki nie mogą się powtarzać"),
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
        media: Zap,
      };
    },
  },
});
