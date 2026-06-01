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
    // Brand first (Excel + manual)
    // ----------------------------------------
    defineField({
      name: "brandName",
      title: "Marka",
      type: "string",
      group: GROUP.MAIN_CONTENT,
      description: "Nazwa marki produktu CPO.",
      validation: (Rule) => Rule.required().error("Nazwa marki jest wymagana"),
    }),
    // ----------------------------------------
    // Core: Name + Product Type Toggle
    // ----------------------------------------
    defineField({
      name: "name",
      type: "string",
      title: "Nazwa",
      group: GROUP.MAIN_CONTENT,
      description: "Nazwa egzemplarza lub nazwa produktu.",
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
        Rule.required().error(
          "Wybierz typ produktu (wewnętrzny lub zewnętrzny)",
        ),
    }),
    defineField({
      name: "externalUrl",
      title: "Link zewnętrzny",
      type: "url",
      description:
        "Adres strony producenta lub dystrybutora z opisem produktu. Widoczny tylko dla typu „Zewnętrzny”.",
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
    // ----------------------------------------
    // Always visible
    // ----------------------------------------
    defineField({
      name: "previewImage",
      title: "Własne zdjęcie główne",
      type: "image",
      description:
        "Opcjonalnie nadpisuje zdjęcie z produktu katalogowego. Jeśli ustawiono powiązanie z katalogiem i nie dodasz tu własnego zdjęcia, jako podgląd CPO zostanie użyte zdjęcie główne z referencji. Gdy nie ma powiązania z katalogiem lub produkt jest zewnętrzny, własne zdjęcie główne jest wymagane.",
      group: GROUP.MAIN_CONTENT,
      options: {
        hotspot: true,
      },
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const doc = context.document as
            | {
                internalProduct?: { _ref?: string };
                productType?: string;
              }
            | undefined;
          // External: always need a card/hero image (no catalog to inherit from).
          if (doc?.productType === "external") {
            if (!value?.asset) {
              return "Zdjęcie główne jest wymagane dla produktów zewnętrznych";
            }
            return true;
          }
          // Internal + catalog link: preview optional (inherit from catalog).
          if (doc?.productType === "internal" && doc?.internalProduct?._ref) {
            return true;
          }
          // Internal without catalog link: must provide a preview image.
          if (doc?.productType === "internal" && !value?.asset) {
            return "Zdjęcie główne jest wymagane, gdy nie ma powiązania z produktem z katalogu";
          }
          return true;
        }),
    }),
    defineField({
      name: "transparentBackground",
      title: "Przezroczyste tło zdjęcia",
      type: "boolean",
      description: "Zaznacz, jeśli zdjęcie ma przezroczyste tło.",
      initialValue: false,
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: "shortDescription",
      title: "Krótki opis",
      optional: false,
      description:
        "Jedyny krótki opis na karcie i w hero. Wpisujesz w Sanity lub treść trafia z kolumny „Opis” w arkuszu CPO (synchronizacja cennika nadpisuje to pole treścią z Excela).",
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ["normal"],
        lists: [],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
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
      name: "isSellableOnline",
      title: "Sprzedaż Online",
      type: "boolean",
      description: "Określa, czy egzemplarz CPO może być kupowany online.",
      initialValue: false,
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: "isReturnable",
      title: "Zwrot",
      type: "boolean",
      description: "Określa, czy egzemplarz CPO jest zwrotny w modelu B2C.",
      initialValue: false,
      group: GROUP.MAIN_CONTENT,
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
    defineField({
      name: "availabilityStatus",
      title: "Status dostępności",
      type: "string",
      description:
        "Operacyjny status dostępności egzemplarza CPO używany przez B2C. ",
      initialValue: "available",
      group: GROUP.MAIN_CONTENT,
      options: {
        layout: "radio",
        list: [
          {
            title: "Dostępny",
            value: "available",
          },
          {
            title: "Wstrzymany przez zamówienie",
            value: "on_hold",
          },
          {
            title: "Sprzedany",
            value: "sold_out",
          },
          {
            title: "Ręcznie niedostępny",
            value: "manually_unavailable",
          },
        ],
      },
      validation: (Rule) =>
        Rule.required().error("Status dostępności jest wymagany"),
    }),
    defineField({
      name: "holdUntil",
      title: "Rezerwacja do",
      type: "datetime",
      description:
        "Opcjonalna data i godzina końca blokady egzemplarza, gdy status to „Wstrzymany przez zamówienie”.",
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }) => document?.availabilityStatus !== "on_hold",
      options: {
        dateFormat: "YYYY-MM-DD",
        timeFormat: "HH:mm",
      },
    }),
    defineField({
      name: "holdOrderNumber",
      title: "Numer zamówienia rezerwacji",
      type: "string",
      description:
        "Techniczne pole B2C: zamówienie, które aktualnie blokuje egzemplarz.",
      group: GROUP.MAIN_CONTENT,
      readOnly: true,
      hidden: ({ document }) => document?.availabilityStatus !== "on_hold",
    }),
    defineField({
      name: "holdPaymentSessionId",
      title: "Sesja płatności rezerwacji",
      type: "string",
      description:
        "Techniczne pole B2C: identyfikator sesji płatności powiązanej z blokadą.",
      group: GROUP.MAIN_CONTENT,
      readOnly: true,
      hidden: ({ document }) => document?.availabilityStatus !== "on_hold",
    }),
    defineField({
      name: "soldOrderNumber",
      title: "Numer zamówienia sprzedaży",
      type: "string",
      description:
        "Techniczne pole B2C: zamówienie, które sprzedało egzemplarz.",
      group: GROUP.MAIN_CONTENT,
      readOnly: true,
      hidden: ({ document }) => document?.availabilityStatus !== "sold_out",
    }),
    defineField({
      name: "availabilityUpdatedAt",
      title: "Status dostępności zaktualizowany",
      type: "datetime",
      description:
        "Techniczne pole B2C: data ostatniej automatycznej zmiany statusu dostępności.",
      group: GROUP.MAIN_CONTENT,
      readOnly: true,
      options: {
        dateFormat: "YYYY-MM-DD",
        timeFormat: "HH:mm",
      },
    }),

    // ----------------------------------------
    // Catalog link (Excel sync)
    // ----------------------------------------
    defineField({
      name: "internalProduct",
      title: "Produkt z katalogu Audiofast",
      type: "reference",
      to: [{ type: "product" }],
      description:
        "Opcjonalne powiązanie z katalogiem. Gdy ustawione: możesz zostawić puste własne zdjęcie główne, a podgląd CPO automatycznie użyje zdjęcia głównego z referencji. Możesz też wybrać galerię z katalogu zamiast własnej.",
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }) => document?.productType === "external",
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
          description: 'Jeśli puste, zostanie użyte "O produkcie".',
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
      name: "useCustomGallery",
      title: "Własna galeria zdjęć",
      type: "boolean",
      description:
        "Wyłączone → w sekcji „Galeria” na stronie używana jest galeria z produktu katalogowego (wymaga powiązania z katalogiem). Włączone → używana jest galeria z tego dokumentu poniżej.",
      initialValue: false,
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }) =>
        document?.productType === "external" || !document?.internalProduct,
    }),
    defineField({
      name: "imageGallery",
      title: "Galeria zdjęć",
      type: "array",
      description:
        "Zdjęcia konkretnego egzemplarza (stan, kąty, kontekst). Ukryte, gdy wybrano galerię z katalogu (wyłączona własna galeria przy ustawionym produkcie katalogowym).",
      of: [{ type: "image" }],
      group: GROUP.MAIN_CONTENT,
      hidden: ({ document }) => {
        if (document?.productType === "external") return true;
        const doc = document as {
          internalProduct?: { _ref?: string };
          useCustomGallery?: boolean;
        } | null;
        const hasCatalogRef = !!doc?.internalProduct?._ref;
        const useOwnGallery = doc?.useCustomGallery === true;
        if (hasCatalogRef && !useOwnGallery) return true;
        return false;
      },
    }),
    defineField({
      name: "technicalData",
      title: "Dane techniczne",
      type: "object",
      description: '⚠️ Edytuj dane techniczne w zakładce "Dane techniczne".',
      icon: Table,
      group: GROUP.MAIN_CONTENT,
      hidden: true,
      fields: technicalDataFields,
    }),

    // ----------------------------------------
    // SEO
    // ----------------------------------------
    ...getSEOFields({
      exclude: ["hideFromList", "doNotIndex"],
      hideTitle: true,
    }),
  ],
  preview: {
    select: {
      title: "name",
      brandName: "brandName",
      media: "previewImage",
      referenceMedia: "internalProduct.previewImage",
    },
    prepare: ({ title, brandName, media, referenceMedia }) => ({
      title,
      subtitle: brandName,
      media: media || referenceMedia || Package,
    }),
  },
});
