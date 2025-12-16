import { GitCompareArrows } from "lucide-react";
import { defineArrayMember, defineField, defineType } from "sanity";

export const comparatorConfig = defineType({
  name: "comparatorConfig",
  title: "Konfiguracja porównywarki",
  type: "document",
  icon: GitCompareArrows,
  description:
    "Konfiguracja parametrów dostępnych do porównania dla każdej kategorii produktów.",
  fields: [
    defineField({
      name: "categoryConfigs",
      title: "Konfiguracje kategorii",
      type: "array",
      description: "Lista konfiguracji dla poszczególnych kategorii produktów.",
      of: [
        defineArrayMember({
          type: "object",
          name: "categoryConfig",
          title: "Konfiguracja kategorii",
          fields: [
            defineField({
              name: "category",
              title: "Kategoria",
              type: "reference",
              to: [{ type: "productCategorySub" }],
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "enabledParameters",
              title: "Włączone parametry",
              type: "array",
              description:
                "Lista nazw parametrów technicznych, które można porównywać w tej kategorii. Kolejność na liście określa kolejność w porównywarce.",
              of: [
                defineArrayMember({
                  type: "object",
                  name: "parameter",
                  fields: [
                    defineField({
                      name: "name",
                      title: "Nazwa parametru",
                      type: "string",
                      validation: (Rule) => Rule.required(),
                    }),
                    defineField({
                      name: "displayName",
                      title: "Nazwa wyświetlana (opcjonalnie)",
                      type: "string",
                      description:
                        "Alternatywna nazwa do wyświetlenia w porównywarce. Jeśli pusta, użyta zostanie oryginalna nazwa.",
                    }),
                  ],
                  preview: {
                    select: {
                      name: "name",
                      displayName: "displayName",
                    },
                    prepare: ({ name, displayName }) => ({
                      title: displayName || name || "Parametr",
                      subtitle: displayName ? name : undefined,
                    }),
                  },
                }),
              ],
            }),
          ],
          preview: {
            select: {
              categoryName: "category.name",
              parametersCount: "enabledParameters",
            },
            prepare: ({ categoryName, parametersCount }) => ({
              title: categoryName || "Kategoria",
              subtitle: `${parametersCount?.length || 0} parametrów`,
            }),
          },
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({
      title: "Konfiguracja porównywarki",
      media: GitCompareArrows,
    }),
  },
});
