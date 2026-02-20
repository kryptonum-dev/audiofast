import {
  orderRankField,
  orderRankOrdering,
} from "@sanity/orderable-document-list";
import { Folder } from "lucide-react";
import { defineField, defineType } from "sanity";

import { defineSlugForDocument } from "../../../components/define-slug-for-document";
import { GROUP, GROUPS } from "../../../utils/constant";
import { customPortableText } from "../../portableText";
import { getSEOFields } from "../../shared/seo";

export const productCategorySub = defineType({
  name: "productCategorySub",
  title: "Kategoria podrzędna",
  type: "document",
  icon: Folder,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    "Podkategoria produktów audio. Musi być przypisana do jednej kategorii nadrzędnej.",
  fields: [
    orderRankField({ type: "productCategories" }),
    defineField({
      name: "parentCategory",
      title: "Kategoria nadrzędna",
      type: "reference",
      description:
        "Wybierz kategorię nadrzędną, do której należy ta podkategoria.",
      to: [{ type: "productCategoryParent" }],
      validation: (Rule) =>
        Rule.required().error("Kategoria nadrzędna jest wymagana"),
      group: GROUP.MAIN_CONTENT,
    }),
    ...defineSlugForDocument({
      prefix: "/kategoria/",
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: "title",
      title: "Tytuł kategorii (opcjonalnie)",
      description:
        "Niestandardowy tytuł dla strony kategorii. Jeśli nie ustawiony, używany będzie domyślny tytuł z głównej strony produktów. Ustaw aby nadpisać domyślny tytuł.",
      group: GROUP.MAIN_CONTENT,
      optional: true,
      include: {
        styles: ["normal", "h2"],
        lists: ["bullet", "number"],
        decorators: ["strong"],
        annotations: ["customLink"],
      },
    }),
    customPortableText({
      name: "description",
      title: "Opis kategorii (opcjonalnie)",
      description:
        "Niestandardowy opis dla strony kategorii. Jeśli nie ustawiony, używany będzie domyślny opis z głównej strony produktów. Ustaw aby nadpisać domyślny opis.",
      group: GROUP.MAIN_CONTENT,
      optional: true,
      include: {
        styles: ["normal", "h2"],
        lists: ["bullet", "number"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    defineField({
      name: "heroImage",
      title: "Obraz tła kategorii (opcjonalnie)",
      type: "image",
      description:
        "Niestandardowy obraz tła dla strony kategorii. Jeśli nie ustawiony, używany będzie domyślny obraz z głównej strony produktów.",
      group: GROUP.MAIN_CONTENT,
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: "customFilters",
      title: "Konfiguracja filtrów",
      type: "array",
      description:
        '⚠️ Edytuj filtry w zakładce "Konfiguracja filtrów" powyżej. To pole jest zarządzane przez dedykowany widok.',
      group: GROUP.MAIN_CONTENT,
      // Hidden - managed via dedicated "Konfiguracja filtrów" view tab
      hidden: true,
      of: [{ type: "customFilterDefinition" }],
      validation: (Rule) =>
        Rule.custom((filters) => {
          if (!filters || !Array.isArray(filters)) return true;
          const names = filters
            .map((f: any) => f.name?.toLowerCase())
            .filter(Boolean);
          const uniqueNames = new Set(names);
          if (names.length !== uniqueNames.size) {
            return "Nazwy filtrów muszą być unikalne";
          }
          return true;
        }),
    }),
    defineField({
      name: "pageBuilder",
      title: "Niestandardowe sekcje",
      type: "pageBuilder",
      description:
        "Niestandardowe sekcje dla tej strony kategorii. Jeśli nie ustawione, sekcje ze strony głównej produktów będą użyte jako fallback.",
      group: GROUP.MAIN_CONTENT,
    }),
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: "name",
      description: "description",
      parentName: "parentCategory.name",
    },
    prepare: ({ name, description, parentName }) => ({
      title: name || "Kategoria podrzędna",
      media: Folder,
      subtitle: parentName
        ? `${description || "Podkategoria"} → ${parentName}`
        : description || "Podkategoria (brak kategorii nadrzędnej)",
    }),
  },
});
