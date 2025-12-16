import { defineField, defineType } from "sanity";

import { createRadioListLayout, isValidUrl } from "../../utils/helper";

const allLinkableTypes = [
  { type: "page" },
  { type: "blog-article" },
  { type: "review" },
  { type: "product" },
  { type: "brand" },
  { type: "blog-category" },
  { type: "productCategorySub" },
  { type: "store" },
  { type: "homePage" },
  { type: "blog" },
  { type: "products" },
  { type: "brands" },
  { type: "termsAndConditions" },
  { type: "privacyPolicy" },
  { type: "cpoPage" },
];

export const customUrl = defineType({
  name: "customUrl",
  type: "object",
  description:
    "Skonfiguruj link, który może wskazywać na stronę wewnętrzną lub zewnętrzną stronę internetową",
  fields: [
    defineField({
      name: "type",
      type: "string",
      description:
        "Wybierz, czy ten link wskazuje na inną stronę w Twojej witrynie (wewnętrzny) czy na inną stronę internetową (zewnętrzny)",
      options: createRadioListLayout([
        { title: "Wewnętrzny", value: "internal" },
        { title: "Zewnętrzny", value: "external" },
      ]),
      initialValue: () => "external",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "openInNewTab",
      title: "Otwórz w nowej karcie",
      type: "boolean",
      description:
        "Gdy włączone, kliknięcie tego linku otworzy miejsce docelowe w nowej karcie przeglądarki zamiast przechodzić z bieżącej strony",
      initialValue: () => false,
    }),
    defineField({
      name: "external",
      type: "string",
      title: "Adres URL",
      description:
        "Wprowadź pełny adres internetowy (URL) zaczynający się od https:// dla stron zewnętrznych lub ścieżkę względną jak /o-nas dla stron wewnętrznych",
      hidden: ({ parent }) => parent?.type !== "external",
      validation: (Rule) => [
        Rule.custom((value, { parent }) => {
          const type = (parent as { type?: string })?.type;
          if (type === "external") {
            if (!value) return "URL nie może być pusty";
            const isValid = isValidUrl(value);
            if (!isValid) return "Nieprawidłowy URL";
          }
          return true;
        }),
      ],
    }),
    defineField({
      name: "href",
      type: "string",
      description:
        "Pole techniczne używane wewnętrznie do przechowywania pełnego URL - nie musisz tego modyfikować",
      initialValue: () => "#",
      hidden: true,
      readOnly: true,
    }),
    defineField({
      name: "internal",
      title: "Strona wewnętrzna",
      type: "reference",
      description:
        "Wybierz, na którą stronę w Twojej witrynie ten link ma wskazywać",
      options: { disableNew: true },
      hidden: ({ parent }) => parent?.type !== "internal",
      to: allLinkableTypes,
      validation: (rule) => [
        rule.custom((value, { parent }) => {
          const type = (parent as { type?: string })?.type;
          if (type === "internal" && !value?._ref)
            return "link wewnętrzny nie może być pusty";
          return true;
        }),
      ],
    }),
  ],
  preview: {
    select: {
      externalUrl: "external",
      urlType: "type",
      internalUrl: "internal.slug.current",
      openInNewTab: "openInNewTab",
    },
    prepare({ externalUrl, urlType, internalUrl, openInNewTab }) {
      const url = urlType === "external" ? externalUrl : `/${internalUrl}`;
      const newTabIndicator = openInNewTab ? " ↗" : "";
      const truncatedUrl =
        url?.length > 30 ? `${url.substring(0, 30)}...` : url;

      return {
        title: `Link ${urlType === "external" ? "zewnętrzny" : "wewnętrzny"}`,
        subtitle: `${truncatedUrl}${newTabIndicator}`,
      };
    },
  },
});
