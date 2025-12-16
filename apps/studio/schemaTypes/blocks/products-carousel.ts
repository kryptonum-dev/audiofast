import { PackageOpen } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Karuzela produktów";

export const productsCarousel = defineType({
  name: "productsCarousel",
  icon: PackageOpen,
  type: "object",
  title,
  description:
    "Karuzela wyświetlająca produkty (np. powiązane produkty, nowości, bestsellery)",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      type: "heading",
    }),
    defineField({
      name: "products",
      title: "Produkty",
      type: "array",
      description:
        "Wybierz produkty do wyświetlenia w karuzeli (minimum 4, maksimum 12)",
      of: [
        {
          type: "reference",
          to: [{ type: "product" }],
          options: {
            disableNew: true,
            filter: ({ parent, document }) => {
              // Prevent duplicate selections
              const selectedIds =
                (parent as { _ref?: string }[])
                  ?.filter((item) => item._ref)
                  .map((item) => item._ref) || [];

              // Exclude current product if on product detail page
              const currentProductId = document?._id?.replace(/^drafts\./, "");
              const excludedIds = currentProductId
                ? [...selectedIds, currentProductId]
                : selectedIds;

              return {
                filter:
                  '!(_id in $excludedIds) && !(_id in path("drafts.**")) && isArchived != true',
                params: { excludedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) => [
        Rule.min(4).error("Musisz wybrać co najmniej 4 produkty"),
        Rule.max(12).error("Możesz wybrać maksymalnie 12 produktów"),
        Rule.required().error("Produkty są wymagane"),
        Rule.unique().error("Każdy produkt może być wybrany tylko raz"),
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
        media: PackageOpen,
      };
    },
  },
});
