import { Newspaper } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

export const latestPublication = defineType({
  name: "latestPublication",
  title: "Najnowsza publikacja",
  icon: Newspaper,
  type: "object",
  description:
    "Sekcja wyświetlająca najnowszą publikację - może być to artykuł blogowy, recenzja produktu lub produkt z danymi publikacji",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      description:
        'Główny nagłówek sekcji najnowszej publikacji (np. "Najnowsza publikacja")',
      type: "heading",
      maxLength: 60,
    }),
    defineField({
      name: "selectionMode",
      title: "Tryb wyboru publikacji",
      type: "string",
      description: "Wybierz, czy wyświetlić najnowszą publikację automatycznie, czy ręcznie wybraną",
      options: {
        list: [
          { title: "Najnowsza publikacja (automatycznie)", value: "latest" },
          { title: "Ręcznie wybrana publikacja", value: "manual" },
        ],
        layout: "radio",
      },
      initialValue: "latest",
      validation: (Rule) => Rule.required().error("Tryb wyboru jest wymagany"),
    }),
    defineField({
      name: "publication",
      title: "Wybierz publikację",
      type: "reference",
      description:
        "Wybierz publikację do wyświetlenia - może być to artykuł blogowy, recenzja lub produkt (z obrazem publikacji lub krótkim opisem)",
      hidden: ({ parent }) => parent?.selectionMode !== "manual",
      to: [{ type: "blog-article" }, { type: "review" }, { type: "product" }],
      options: {
        filter: `!(_id in path("drafts.**")) && (
          _type != "product" ||
          (defined(publicationImage) &&
          defined(shortDescription))
        )`,
      },
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { selectionMode?: string };
          if (parent?.selectionMode === "manual" && !value) {
            return "Publikacja jest wymagana w trybie ręcznego wyboru";
          }
          return true;
        }),
    }),
  ],
  preview: {
    select: {
      heading: "heading",
      selectionMode: "selectionMode",
      publication: "publication",
      publicationType: "publication._type",
      title: "publication.title",
      name: "publication.name",
    },
    prepare: ({ heading, selectionMode, publication, publicationType, title, name }) => {
      // Get heading text if available
      const headingText = toPlainText(heading) || "Najnowsza publikacja";

      // Handle automatic latest mode
      if (selectionMode === "latest" || !selectionMode) {
        return {
          title: headingText,
          subtitle: "Automatycznie: najnowsza publikacja",
          media: Newspaper,
        };
      }

      // Get display name - prefer title if it's portable text, fallback to name
      const displayName = toPlainText(title) || name || "Brak tytułu";

      // Determine publication type for subtitle
      const typeLabel =
        publicationType === "blog-article"
          ? "Artykuł blogowy"
          : publicationType === "product"
            ? "Produkt"
            : "Recenzja";

      return {
        title: headingText,
        subtitle: publication
          ? `Ręcznie: ${typeLabel} - ${displayName}`
          : "Nie wybrano publikacji",
        media: Newspaper,
      };
    },
  },
});
