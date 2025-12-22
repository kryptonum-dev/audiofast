import { Speaker } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Wyróżnione produkty";

export const featuredProducts = defineType({
  name: "featuredProducts",
  title,
  icon: Speaker,
  type: "object",
  description:
    "Sekcja z karuzelą wyróżnionych produktów - nowości i bestsellery",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      description:
        'Główny nagłówek sekcji wyróżnionych produktów (np. "Najchętniej wybierane rozwiązania audio klasy high-end")',
      type: "heading",
    }),
    customPortableText({
      name: "description",
      title: "Opis sekcji",
      description: "Krótki opis sekcji wyróżnionych produktów",
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    defineField({
      name: "button",
      title: "Przycisk CTA",
      type: "button",
      description: "Główny przycisk wezwania do działania sekcji",
      validation: (Rule) => Rule.required().error("Przycisk CTA jest wymagany"),
    }),
    defineField({
      name: "newProductsMode",
      title: "Tryb wyboru nowych produktów",
      type: "string",
      description:
        "Wybierz, czy automatycznie pobrać 10 najnowszych produktów, czy wybrać ręcznie",
      options: {
        list: [
          { title: "Automatycznie (10 najnowszych)", value: "automatic" },
          { title: "Ręcznie wybrane", value: "manual" },
        ],
        layout: "radio",
      },
      initialValue: "automatic",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "newProducts",
      title: "Nowe produkty",
      type: "array",
      description: "Wybierz nowe produkty do wyświetlenia (3-8 elementów)",
      hidden: ({ parent }) => parent?.newProductsMode !== "manual",
      of: [
        {
          type: "reference",
          to: [{ type: "product" }],
          options: {
            disableNew: true,
            filter: ({ parent, document }) => {
              // Get selected IDs from this section
              const selectedIds =
                (parent as { _ref?: string }[])
                  ?.filter((item) => item._ref)
                  .map((item) => item._ref) || [];

              // Get selected IDs from bestsellers section too
              const bestsellerIds = Array.isArray(
                (document as any)?.bestsellers,
              )
                ? (document as any).bestsellers
                    .map((item: any) => item._ref)
                    .filter(Boolean)
                : [];

              const allSelected = [...selectedIds, ...bestsellerIds];

              return {
                filter:
                  '!(_id in $selectedIds) && !(_id in path("drafts.**")) && isArchived != true',
                params: { selectedIds: allSelected },
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { newProductsMode?: string };
          if (parent?.newProductsMode === "manual") {
            if (!value || !Array.isArray(value) || value.length < 3) {
              return "Minimum 3 produkty są wymagane";
            }
            if (value.length > 8) {
              return "Maksimum 8 produktów";
            }
          }
          return true;
        }),
    }),
    defineField({
      name: "bestsellers",
      title: "Bestsellery",
      type: "array",
      description:
        "Wybierz produkty-bestsellery do wyświetlenia (3-8 elementów)",
      of: [
        {
          type: "reference",
          to: [{ type: "product" }],
          options: {
            disableNew: true,
            filter: ({ parent, document }) => {
              // Get selected IDs from this section
              const selectedIds =
                (parent as { _ref?: string }[])
                  ?.filter((item) => item._ref)
                  .map((item) => item._ref) || [];

              // Get selected IDs from new products section too
              const newProductIds = Array.isArray(
                (document as any)?.newProducts,
              )
                ? (document as any).newProducts
                    .map((item: any) => item._ref)
                    .filter(Boolean)
                : [];

              const allSelected = [...selectedIds, ...newProductIds];

              return {
                filter:
                  '!(_id in $selectedIds) && !(_id in path("drafts.**")) && isArchived != true',
                params: { selectedIds: allSelected },
              };
            },
          },
        },
      ],
      validation: (Rule) => [
        Rule.min(3).error("Minimum 3 produkty"),
        Rule.max(8).error("Maksimum 8 produktów"),
        Rule.required().error("Produkty są wymagane"),
        Rule.unique().error("Każdy produkt może być wybrany tylko raz"),
      ],
    }),
  ],
  preview: {
    select: {
      heading: "heading",
      description: "description",
      newProductsMode: "newProductsMode",
      newProductsCount: "newProducts",
    },
    prepare: ({ heading, description, newProductsMode, newProductsCount }) => {
      const modeLabel =
        newProductsMode === "manual"
          ? `Ręcznie (${Array.isArray(newProductsCount) ? newProductsCount.length : 0})`
          : "Auto (10 najnowszych)";

      return {
        title,
        subtitle: `${toPlainText(heading) || toPlainText(description) || "Nowości i bestsellery"} | Nowości: ${modeLabel}`,
        media: Speaker,
      };
    },
  },
});
