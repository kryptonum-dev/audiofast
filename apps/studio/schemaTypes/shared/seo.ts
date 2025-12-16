import { defineField } from "sanity";

import { GROUP } from "../../utils/constant";

type ExcludableFields = "hideFromList" | "doNotIndex" | "openGraph";

interface GetSEOFieldsOptions {
  exclude?: ExcludableFields[];
  /** If true, meta description is required. Default: false (optional, falls back to home page description) */
  descriptionRequired?: boolean;
}

export function getSEOFields(options?: GetSEOFieldsOptions) {
  const { exclude = [], descriptionRequired = false } = options || {};

  const fields = [];

  // Required SEO fields (cannot be excluded) - wrapped in object
  fields.push(
    defineField({
      name: "seo",
      title: "SEO",
      type: "object",
      group: GROUP.SEO,
      validation: (rule) => rule.required().error("SEO jest wymagane"),
      fields: [
        defineField({
          name: "title",
          title: "Meta tytuł SEO",
          description:
            "To nadpisze meta tytuł. Jeśli pozostanie puste, odziedziczy tytuł strony.",
          type: "string",
          validation: (rule) => [
            rule.required().error("Tytuł SEO jest wymagany"),
            rule.max(70).warning("Nie więcej niż 70 znaków"),
          ],
        }),
        defineField({
          name: "description",
          title: "Meta opis SEO",
          description: descriptionRequired
            ? "Meta opis strony wyświetlany w wynikach wyszukiwania."
            : "Meta opis strony. Jeśli pozostanie puste, zostanie użyty opis ze strony głównej.",
          type: "text",
          rows: 2,
          validation: (rule) => {
            const rules = [
              rule.min(110).warning("Nie mniej niż 110 znaków"),
              rule.max(160).warning("Nie więcej niż 160 znaków"),
            ];
            if (descriptionRequired) {
              rules.unshift(rule.required().error("Opis SEO jest wymagany"));
            }
            return rules;
          },
        }),
      ],
    }),
  );

  // Optional: Do not index field
  if (!exclude.includes("doNotIndex")) {
    fields.push(
      defineField({
        name: "doNotIndex",
        title: "Nie indeksuj tej strony",
        description:
          "Jeśli zaznaczone, ta treść nie będzie indeksowana przez wyszukiwarki.",
        type: "boolean",
        initialValue: false,
        group: GROUP.SEO,
      }),
    );
  }

  // Optional: Hide from lists field
  if (!exclude.includes("hideFromList")) {
    fields.push(
      defineField({
        name: "hideFromList",
        title: "Ukryj z list",
        description:
          "Jeśli zaznaczone, ta treść nie pojawi się na żadnych stronach z listami.",
        type: "boolean",
        initialValue: false,
        group: GROUP.SEO,
      }),
    );
  }

  // Optional: Open Graph fields
  if (!exclude.includes("openGraph")) {
    fields.push(
      defineField({
        name: "openGraph",
        title: "Open Graph (Opcjonalnie)",
        type: "object",
        group: GROUP.OG,
        options: {
          collapsible: true,
          collapsed: true,
        },
        fields: [
          defineField({
            name: "title",
            title: "Tytuł Open Graph",
            description:
              "To nadpisze tytuł Open Graph. Jeśli pozostanie puste, odziedziczy tytuł SEO.",
            type: "string",
          }),
          defineField({
            name: "description",
            title: "Opis Open Graph",
            description:
              "To nadpisze opis Open Graph. Jeśli pozostanie puste, odziedziczy opis SEO.",
            type: "text",
            rows: 2,
            validation: (rule) =>
              rule.max(160).warning("Nie więcej niż 160 znaków"),
          }),
          defineField({
            name: "image",
            title: "Obraz Open Graph",
            description:
              "To nadpisze główny obraz. Jeśli pozostanie puste, odziedziczy obraz z głównego obrazu.",
            type: "image",
            options: {
              hotspot: true,
            },
          }),
        ],
      }),
    );
  }

  return fields;
}
