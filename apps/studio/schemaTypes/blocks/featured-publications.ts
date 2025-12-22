import { Highlighter } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Wyróżnione publikacje";

export const featuredPublications = defineType({
  name: "featuredPublications",
  title,
  icon: Highlighter,
  type: "object",
  description:
    "Sekcja z karuzelą wyróżnionych publikacji - artykułów blogowych, recenzji i produktów z danymi publikacji",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      description:
        'Główny nagłówek sekcji wyróżnionych publikacji (np. "Wyróżnione publikacje")',
      type: "heading",
    }),
    defineField({
      name: "selectionMode",
      title: "Tryb wyboru publikacji",
      type: "string",
      description:
        "Wybierz sposób wyświetlania publikacji: automatycznie od najnowszej, od 2. najnowszej lub ręcznie wybrane",
      options: {
        list: [
          {
            title: "Najnowsze publikacje (od najnowszej)",
            value: "latest",
          },
          {
            title: "Najnowsze publikacje (od 2. najnowszej)",
            value: "secondLatest",
          },
          {
            title: "Ręcznie wybrane publikacje",
            value: "manual",
          },
        ],
        layout: "radio",
      },
      initialValue: "secondLatest",
      validation: (Rule) => Rule.required().error("Tryb wyboru jest wymagany"),
    }),
    defineField({
      name: "publications",
      title: "Wyróżnione publikacje",
      type: "array",
      description:
        "Wybierz publikacje do wyświetlenia w karuzeli (5-10 elementów). Produkty mogą być dodane tylko jeśli mają ustawiony obraz publikacji lub krótki opis.",
      hidden: ({ parent }) => parent?.selectionMode !== "manual",
      of: [
        {
          type: "reference",
          to: [{ type: "blog-article" }, { type: "review" }, { type: "product" }],
          options: {
            disableNew: true,
            filter: ({ parent }) => {
              const selectedIds =
                (parent as { _ref?: string }[])
                  ?.filter((item) => item._ref)
                  .map((item) => item._ref) || [];
              return {
                filter: `!(_id in $selectedIds) && !(_id in path("drafts.**")) && (
                  _type != "product" ||
                  (defined(publicationImage) &&
                  defined(shortDescription))
                )`,
                params: { selectedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { selectionMode?: string };
          if (parent?.selectionMode === "manual") {
            if (!value || value.length === 0) {
              return "Publikacje są wymagane w trybie ręcznego wyboru";
            }
            if (value.length < 5) {
              return "Minimum 5 publikacji";
            }
            if (value.length > 10) {
              return "Maksimum 10 publikacji";
            }
          }
          return true;
        }),
    }),
  ],
  preview: {
    select: {
      heading: "heading",
      selectionMode: "selectionMode",
      publicationsCount: "publications.length",
    },
    prepare: ({ heading, selectionMode, publicationsCount }) => {
      const modeLabels: Record<string, string> = {
        latest: "Automatycznie: od najnowszej (20 publikacji)",
        secondLatest: "Automatycznie: od 2. najnowszej (20 publikacji)",
        manual: `Ręcznie: ${publicationsCount || 0} publikacji`,
      };

      return {
        title,
        subtitle: `${toPlainText(heading) || "Brak nagłówka"} • ${modeLabels[selectionMode || "secondLatest"]}`,
        media: Highlighter,
      };
    },
  },
});
