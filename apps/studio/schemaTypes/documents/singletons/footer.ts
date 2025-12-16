import { PanelBottom } from "lucide-react";
import { defineField, defineType } from "sanity";

export const footer = defineType({
  name: "footer",
  type: "document",
  title: "Stopka",
  icon: PanelBottom,
  description: "Treść stopki dla Twojej strony internetowej",
  fields: [
    defineField({
      name: "highlightedSocialMedia",
      type: "array",
      title: "Wyróżnione media społecznościowe",
      validation: (Rule) => [
        Rule.required().error("Wyróżnione media społecznościowe są wymagane"),
        Rule.min(1).error("Minimum 1 wyróżnione media społecznościowe"),
        Rule.max(3).error("Maksimum 3 wyróżnione media społecznościowe"),
      ],
      of: [
        {
          type: "reference",
          to: [{ type: "socialMedia" }],
          options: {
            filter: ({ document }) => {
              const selectedIds = Array.isArray(
                document?.highlightedSocialMedia,
              )
                ? document.highlightedSocialMedia
                    .map((item: any) => item._ref)
                    .filter(Boolean)
                : [];
              return {
                filter: "!(_id in $selectedIds)",
                params: { selectedIds },
              };
            },
          },
        },
      ],
    }),
    defineField({
      name: "links",
      type: "array",
      title: "Linki w stopce",
      of: [{ type: "buttonWithNoVariant", title: "Link w stopce" }],
      validation: (rule) => [
        rule.required().error("Linki są wymagane"),
        rule.min(2).error("Minimum 2 linki"),
        rule.max(6).error("Maksimum 6 linków"),
      ],
    }),
    defineField({
      name: "newsletter",
      type: "object",
      title: "Newsletter",
      fields: [
        defineField({
          name: "label",
          type: "string",
          title: "Etykieta sekcji",
          description: "Tekst dla sekcji newslettera",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "buttonLabel",
          type: "string",
          title: "Etykieta przycisku",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "formState",
          type: "formState",
          title: "Stan formularza",
        }),
      ],
    }),
  ],
  preview: {
    select: {
      links: "links",
    },
    prepare: () => ({
      title: "Stopka",
      media: PanelBottom,
    }),
  },
});
