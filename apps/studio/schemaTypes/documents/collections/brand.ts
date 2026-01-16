import {
  orderRankField,
  orderRankOrdering,
} from "@sanity/orderable-document-list";
import { Tag } from "lucide-react";
import { defineField, defineType } from "sanity";

import { defineSlugForDocument } from "../../../components/define-slug-for-document";
import { GROUP, GROUPS } from "../../../utils/constant";
import { toPlainText } from "../../../utils/helper";
import { customPortableText } from "../../portableText";
import { getSEOFields } from "../../shared/seo";

export const brand = defineType({
  name: "brand",
  title: "Marka",
  type: "document",
  icon: Tag,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    "Marka produktów audio. Dodaj nazwę marki, opis i informacje o producencie.",
  fields: [
    orderRankField({ type: "brands" }),
    defineField({
      name: "doNotShowBrand",
      title: "Nie pokazuj marki",
      type: "boolean",
      description:
        "Jeśli zaznaczone, marka nie będzie wyświetlana w żadnych sekcjach marek ani na liście produktów. Produkty tej marki również nie będą widoczne na listingach.",
      group: GROUP.MAIN_CONTENT,
      initialValue: false,
    }),
    ...defineSlugForDocument({
      prefix: "/marki/",
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: "logo",
      title: "Logo Marki",
      type: "image",
      validation: (Rule) => Rule.required(),
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: "description",
      title: "Opis marki (Hero)",
      description:
        "Krótki opis wyświetlany pod nazwą marki w sekcji hero na stronie marki",
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
      },
      validation: (Rule) => Rule.required().error("Opis marki jest wymagany"),
    }),
    defineField({
      name: "heroImage",
      title: "Obraz tła strony marki (opcjonalny)",
      type: "image",
      description:
        "Obraz wyświetlany w tle sekcji hero na stronie marki. Jeśli obraz nie zostanie ustawiony, wyswietlony zostanie obraz z podstrony /marki/.",
      group: GROUP.MAIN_CONTENT,
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: "bannerImage",
      title: "Obraz banera (opcjonalny)",
      type: "image",
      description:
        "Duży obraz banera wyświetlany między listą produktów a sekcją o marce",
      group: GROUP.MAIN_CONTENT,
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: "brandContentBlocks",
      title: "Szczegółowy opis (stary format)",
      type: "array",
      description:
        "⚠️ STARY FORMAT - Użyj pola 'Szczegółowy opis' poniżej. To pole pozostaje dla kompatybilności wstecznej.",
      group: GROUP.MAIN_CONTENT,
      of: [
        { type: "contentBlockText" },
        { type: "contentBlockYoutube" },
        { type: "contentBlockVimeo" },
        { type: "contentBlockHorizontalLine" },
      ],
      options: {
        insertMenu: {
          filter: true,
          showIcons: true,
          views: [{ name: "list" }],
        },
      },
    }),
    customPortableText({
      name: "brandDetailContent",
      title: "Szczegółowy opis",
      description:
        "Zunifikowana treść marki. Użyj 'Sekcja dwukolumnowa' do oznaczenia początku i końca sekcji dwukolumnowych, a 'Podział kolumn' do rozdzielenia lewej i prawej kolumny.",
      group: GROUP.MAIN_CONTENT,
      optional: true,
      include: {
        styles: ["normal", "h3"],
        lists: ["bullet", "number"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
      components: [
        "ptMinimalImage",
        "ptInlineImage",
        "ptHeading",
        "ptYoutubeVideo",
        "ptVimeoVideo",
        "ptPageBreak",
        "ptTwoColumnLine",
        "ptHorizontalLine",
        "ptReviewEmbed",
      ],
    }),
    defineField({
      name: "distributionYear",
      title: "Rok rozpoczęcia dystrybucji (opcjonalny)",
      type: "object",
      description:
        "Rok i obraz tła dla odznaki roku rozpoczęcia dystrybucji. Jeśli ustawisz rok, musisz również ustawić obraz tła i odwrotnie.",
      group: GROUP.MAIN_CONTENT,
      fields: [
        defineField({
          name: "year",
          title: "Rok",
          type: "number",
          description:
            "Rok, w którym AudioFast rozpoczął dystrybucję tej marki (np. 2005)",
          validation: (Rule) =>
            Rule.min(1900)
              .max(new Date().getFullYear())
              .error("Podaj prawidłowy rok"),
        }),
        defineField({
          name: "backgroundImage",
          title: "Obraz tła",
          type: "image",
          description: "Obraz tła wyświetlany za tekstem odznaki roku",
          options: {
            hotspot: true,
          },
        }),
      ],
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true; // Optional field

          const hasYear = value.year !== undefined && value.year !== null;
          const hasImage =
            value.backgroundImage !== undefined &&
            value.backgroundImage !== null;

          if (hasYear && !hasImage) {
            return "Jeśli ustawisz rok, musisz również ustawić obraz tła";
          }

          if (hasImage && !hasYear) {
            return "Jeśli ustawisz obraz tła, musisz również ustawić rok";
          }

          return true;
        }),
    }),
    defineField({
      name: "imageGallery",
      title: "Galeria zdjęć marki",
      type: "array",
      description:
        "Dodaj zdjęcia do galerii marki (opcjonalne, minimum 2 zdjęcia jeśli dodajesz)",
      group: GROUP.MAIN_CONTENT,
      of: [{ type: "image" }],
      validation: (Rule) =>
        Rule.custom((value) => {
          if (
            value &&
            Array.isArray(value) &&
            value.length > 0 &&
            value.length < 2
          ) {
            return "Galeria musi zawierać minimum 2 zdjęcia";
          }
          return true;
        }),
    }),
    defineField({
      name: "stores",
      title: "Salony dystrybucji",
      type: "array",
      description:
        "Wybierz salony, w których dostępne są produkty tej marki. Produkty bez własnych salonów odziedziczą te salony.",
      group: GROUP.MAIN_CONTENT,
      of: [
        {
          type: "reference",
          to: [{ type: "store" }],
          options: {
            filter: ({ document }) => {
              const selectedIds = Array.isArray(document?.stores)
                ? document.stores.map((item: any) => item._ref).filter(Boolean)
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
      name: "featuredReviews",
      title: "Wyróżnione recenzje",
      type: "array",
      description:
        "Wybierz recenzje produktów należących do tej marki. Tylko recenzje przypisane do produktów tej marki są dostępne do wyboru.",
      group: GROUP.MAIN_CONTENT,
      of: [
        {
          type: "reference",
          to: [{ type: "review" }],
          options: {
            filter: ({ document }) => {
              const brandId = document._id?.replace("drafts.", "");
              if (!brandId) return { filter: '_id == "none"' };
              return {
                filter: `_id in *[_type == "product" && brand._ref == $brandId].reviews[]._ref`,
                params: { brandId },
              };
            },
          },
        },
      ],
    }),
    ...getSEOFields(
      {
        exclude: ["hideFromList"],
      }
    ),
  ],
  preview: {
    select: {
      name: "name",
      logo: "logo",
      description: "description",
    },
    prepare: ({ name, logo, description }) => ({
      title: name || "Marka",
      subtitle: toPlainText(description) || "Marka produktów audio",
      media: logo || Tag,
    }),
  },
});
