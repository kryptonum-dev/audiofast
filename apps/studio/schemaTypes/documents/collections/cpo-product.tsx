import { BadgeCheck, Package, Settings, Table } from "lucide-react";
import { defineArrayMember, defineField, defineType } from "sanity";

import { PathnameFieldComponent } from "../../../components/slug-field-component";
import { GROUP, GROUPS } from "../../../utils/constant";
import { isUniqueSlug, slugify } from "../../../utils/helper";
import { customPortableText } from "../../portableText";
import { getSEOFields } from "../../shared/seo";

const CPO_SLUG_PREFIX = "/certyfikowany-sprzet-uzywany/";

// Reusable technical data structure (same as product.technicalData)
const technicalDataFields = [
  defineField({
    name: "variants",
    title: "Warianty produktu",
    type: "array",
    of: [{ type: "string" }],
    description:
      'Nazwy wariantów produktu (np. "Alive", "Excite", "Euphoria"). Pozostaw puste dla produktów bez wariantów.',
  }),
  defineField({
    name: "groups",
    title: "Sekcje danych technicznych",
    type: "array",
    description:
      'Sekcje z parametrami technicznymi (np. "Specyfikacja techniczna", "Specyfikacja audio")',
    of: [
      defineArrayMember({
        type: "object",
        name: "technicalDataGroup",
        title: "Sekcja",
        fields: [
          defineField({
            name: "title",
            title: "Nazwa sekcji",
            type: "string",
            description:
              'Opcjonalnie - np. "Specyfikacja techniczna". Zostaw puste dla produktów bez sekcji.',
          }),
          defineField({
            name: "rows",
            title: "Parametry",
            type: "array",
            of: [
              defineArrayMember({
                type: "object",
                name: "technicalDataRow",
                title: "Parametr techniczny",
                fields: [
                  defineField({
                    name: "title",
                    title: "Nazwa parametru",
                    type: "string",
                    description:
                      'Nazwa specyfikacji (np. "Wzmocnienie", "Impedancja")',
                    validation: (Rule) => Rule.required(),
                  }),
                  defineField({
                    name: "values",
                    title: "Wartości",
                    type: "array",
                    description:
                      "Wartości dla każdego wariantu (lub jedna wartość dla produktów bez wariantów)",
                    of: [
                      defineArrayMember({
                        type: "object",
                        name: "cellValue",
                        title: "Wartość komórki",
                        fields: [
                          defineField({
                            name: "content",
                            title: "Zawartość",
                            type: "array",
                            of: [
                              defineArrayMember({
                                type: "block",
                                styles: [
                                  { title: "Normalny", value: "normal" },
                                ],
                                lists: [
                                  {
                                    title: "Wypunktowana",
                                    value: "bullet",
                                  },
                                  {
                                    title: "Numerowana",
                                    value: "number",
                                  },
                                ],
                                marks: {
                                  decorators: [
                                    {
                                      title: "Pogrubienie",
                                      value: "strong",
                                    },
                                    { title: "Kursywa", value: "em" },
                                  ],
                                  annotations: [
                                    {
                                      name: "link",
                                      type: "object",
                                      title: "Link",
                                      fields: [
                                        defineField({
                                          name: "href",
                                          type: "url",
                                          title: "URL",
                                          validation: (Rule) =>
                                            Rule.uri({
                                              scheme: [
                                                "http",
                                                "https",
                                                "mailto",
                                                "tel",
                                              ],
                                            }),
                                        }),
                                        defineField({
                                          name: "blank",
                                          type: "boolean",
                                          title: "Otwórz w nowej karcie",
                                          initialValue: true,
                                        }),
                                      ],
                                    },
                                  ],
                                },
                              }),
                            ],
                          }),
                        ],
                        preview: {
                          select: { content: "content" },
                          prepare: ({ content }) => {
                            const text =
                              content?.[0]?.children?.[0]?.text ||
                              "Pusta komórka";
                            return {
                              title:
                                text.length > 50
                                  ? text.slice(0, 50) + "..."
                                  : text,
                            };
                          },
                        },
                      }),
                    ],
                  }),
                ],
                preview: {
                  select: { title: "title", values: "values" },
                  prepare: ({ title, values }) => {
                    const valueCount = values?.length || 0;
                    const firstValue =
                      values?.[0]?.content?.[0]?.children?.[0]?.text || "";
                    return {
                      title: title || "Parametr",
                      subtitle:
                        valueCount > 1
                          ? `${valueCount} wariantów`
                          : firstValue || "Brak wartości",
                      media: Settings,
                    };
                  },
                },
              }),
            ],
          }),
        ],
        preview: {
          select: { title: "title", rows: "rows" },
          prepare: ({ title, rows }) => ({
            title: title || "Parametry (bez sekcji)",
            subtitle: `${rows?.length || 0} parametrów`,
            media: Table,
          }),
        },
      }),
    ],
  }),
];

export const cpoProduct = defineType({
  name: "cpoProduct",
  title: "Produkt CPO",
  type: "document",
  icon: BadgeCheck,
  groups: GROUPS,
  description:
    "Egzemplarz produktu w programie Certyfikowany sprzęt używany (CPO). Każdy dokument reprezentuje konkretny egzemplarz używany.",
  fields: [
    // ----------------------------------------
    // Core: Name + Product Type Toggle
    // ----------------------------------------
    defineField({
      name: "name",
      type: "string",
      title: "Nazwa",
      group: GROUP.MAIN_CONTENT,
      description:
        "Nazwa egzemplarza lub nazwa produktu.",
      validation: (Rule) => Rule.required().error("Nazwa jest wymagana"),
    }),
    defineField({
      name: "productType",
      title: "Typ produktu",
      type: "string",
      group: GROUP.MAIN_CONTENT,
      description:
        "Produkt wewnętrzny — z katalogu Audiofast, ma własną podstronę. Produkt zewnętrzny — spoza dystrybucji, link prowadzi do zewnętrznej strony.",
      options: {
        layout: "radio",
        list: [
          {
            title: "Wewnętrzny (produkt Audiofast)",
            value: "internal",
          },
          {
            title: "Zewnętrzny (link do producenta/dystrybutora)",
            value: "external",
          },
        ],
      },
      initialValue: "internal",
      validation: (Rule) =>
        Rule.required().error("Wybierz typ produktu (wewnętrzny lub zewnętrzny)"),
    }),

    // ----------------------------------------
    // Slug (internal only — hidden when external)
    // ----------------------------------------
    defineField({
      name: "slug",
      type: "slug",
      title: "Slug",
      group: GROUP.MAIN_CONTENT,
      description: "Unikalny adres strony produktu CPO.",
      hidden: ({ document }) => document?.productType === "external",
      components: {
        field: (props) => (
          <PathnameFieldComponent {...props} prefix={CPO_SLUG_PREFIX} />
        ),
      },
      options: {
        source: "name",
        slugify: (input: string) => {
          const slugified = `${CPO_SLUG_PREFIX}${slugify(input)}`;
          const withLeadingSlash = slugified.startsWith("/")
            ? slugified
            : `/${slugified}`;
          return withLeadingSlash === "/"
            ? withLeadingSlash
            : `${withLeadingSlash.replace(/\/$/, "")}/`;
        },
        isUnique: isUniqueSlug,
      },
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const doc = context.document as { productType?: string } | undefined;
          if (doc?.productType === "external") return true;
          if (doc?.productType === "internal" && !value?.current) {
            return "Slug jest wymagany dla produktów wewnętrznych";
          }
          if (value?.current && !value.current.endsWith("/")) {
            return "Slug musi kończyć się ukośnikiem (/)";
          }
          return true;
        }),
    }),
    defineField({
      name: "subtitle",
      title: "Podtytuł (opcjonalny)",
      type: "string",
      description: "Np. „Stan: bardzo dobry”.",
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }) => document?.productType === "external",
    }),

    // ----------------------------------------
    // Always visible
    // ----------------------------------------
    defineField({
      name: "previewImage",
      title: "Zdjęcie główne",
      type: "image",
      description:
        "Główne zdjęcie wyświetlane na karcie produktu. Dla egzemplarzy wewnętrznych — także w sekcji hero na stronie szczegółowej.",
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) =>
        Rule.required().error("Zdjęcie główne jest wymagane"),
    }),
    customPortableText({
      name: "shortDescription",
      title: "Krótki opis (opcjonalny)",
      optional: true,
      description:
        "Krótki opis egzemplarza. Może zawierać linki wewnętrzne lub zewnętrzne.",
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: "priceCents",
      title: "Cena (grosze)",
      type: "number",
      description:
        "Cena w groszach (1 PLN = 100 groszy). Tymczasowo wpisywana ręcznie. Docelowo będzie synchronizowana z cennikiem Excel.",
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) => Rule.integer().min(0),
    }),
    defineField({
      name: "publishedDate",
      title: "Data publikacji",
      type: "datetime",
      description:
        "Data publikacji do sortowania (np. od najnowszych). Jeśli pusta, używana jest data utworzenia.",
      group: GROUP.MAIN_CONTENT,
      options: {
        dateFormat: "YYYY-MM-DD",
        timeFormat: "HH:mm",
      },
    }),
    defineField({
      name: "isArchived",
      title: "Archiwum",
      type: "boolean",
      description:
        "Zaznacz, aby przenieść do archiwum. Nie usuwa dokumentu, tylko ukrywa go z listy.",
      initialValue: false,
      group: GROUP.MAIN_CONTENT,
    }),

    // ----------------------------------------
    // Brand: Audiofast reference or external string
    // ----------------------------------------
    defineField({
      name: "brandType",
      title: "Źródło marki",
      type: "string",
      group: GROUP.MAIN_CONTENT,
      description:
        "Wybierz, czy produkt jest z marki z katalogu Audiofast, czy spoza dystrybucji.",
      options: {
        layout: "radio",
        list: [
          {
            title: "Marka Audiofast",
            value: "audiofast",
          },
          {
            title: "Marka zewnętrzna",
            value: "external",
          },
        ],
      },
      initialValue: "audiofast",
      validation: (Rule) =>
        Rule.required().error("Wybierz źródło marki"),
    }),
    defineField({
      name: "brand",
      title: "Marka",
      type: "reference",
      to: [{ type: "brand" }],
      description: "Marka z katalogu Audiofast.",
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }) => document?.brandType !== "audiofast",
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const doc = context.document as { brandType?: string } | undefined;
          if (doc?.brandType === "audiofast" && !value) {
            return "Marka jest wymagana dla marek z katalogu Audiofast";
          }
          return true;
        }),
    }),
    defineField({
      name: "otherBrandName",
      title: "Nazwa marki",
      type: "string",
      description:
        "Nazwa marki spoza dystrybucji Audiofast (np. „Naim Audio”).",
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }) => document?.brandType !== "external",
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const doc = context.document as { brandType?: string } | undefined;
          if (doc?.brandType === "external" && !value?.trim()) {
            return "Nazwa marki jest wymagana dla marek zewnętrznych";
          }
          return true;
        }),
    }),

    // ----------------------------------------
    // Internal only
    // ----------------------------------------
    defineField({
      name: "details",
      title: "Szczegóły produktu",
      type: "object",
      description: "Długi opis egzemplarza z nagłówkiem i treścią.",
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }) => document?.productType === "external",
      fields: [
        customPortableText({
          name: "heading",
          title: "Nagłówek szczegółów (opcjonalny)",
          type: "heading",
          optional: true,
          description:
            'Jeśli puste, zostanie użyte "O produkcie".',
        }),
        customPortableText({
          name: "productDetailContent",
          title: "Szczegółowy opis",
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
      ],
    }),
    defineField({
      name: "imageGallery",
      title: "Galeria zdjęć",
      type: "array",
      description:
        "Zdjęcia konkretnego egzemplarza (stan, kąty, kontekst).",
      of: [{ type: "image" }],
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }) => document?.productType === "external",
    }),
    defineField({
      name: "technicalData",
      title: "Dane techniczne",
      type: "object",
      description:
        '⚠️ Edytuj dane techniczne w zakładce "Dane techniczne".',
      icon: Table,
      group: GROUP.MAIN_CONTENT,
      hidden: true,
      fields: technicalDataFields,
    }),

    // ----------------------------------------
    // External only (productType === "external")
    // ----------------------------------------
    defineField({
      name: "externalUrl",
      title: "Link zewnętrzny",
      type: "url",
      description:
        "Adres strony producenta lub dystrybutora z opisem produktu.",
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }) => document?.productType !== "external",
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const doc = context.document as { productType?: string } | undefined;
          if (doc?.productType === "external" && !value) {
            return "Link zewnętrzny jest wymagany dla produktów zewnętrznych";
          }
          return true;
        }),
    }),
    defineField({
      name: "externalLinkLabel",
      title: "Etykieta linku",
      type: "string",
      description:
        "Tekst przycisku linku (np. „Zobacz na stronie producenta”). Domyślnie: „Zobacz opis produktu”.",
      group: GROUP.MAIN_CONTENT,
      initialValue: "Zobacz opis produktu",
      hidden: ({ document }) => document?.productType !== "external",
    }),

    // ----------------------------------------
    // SEO
    // ----------------------------------------
    ...getSEOFields({ exclude: ["hideFromList"], hideTitle: true }),
  ],
  preview: {
    select: {
      title: "name",
      brandName: "brand.name",
      otherBrandName: "otherBrandName",
      brandType: "brandType",
      productType: "productType",
      media: "previewImage",
      isArchived: "isArchived",
    },
    prepare: ({
      title,
      brandName,
      otherBrandName,
      brandType,
      productType,
      media,
      isArchived,
    }) => ({
      title: `${isArchived ? "[ARCHIWUM] " : ""}${
        productType === "external" ? "[ZEW] " : ""
      }${title}`,
      subtitle: brandType === "external" ? otherBrandName : brandName,
      media: media || Package,
    }),
  },
});
