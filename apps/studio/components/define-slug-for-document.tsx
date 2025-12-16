import { defineField, type SlugDefinition, type SlugOptions } from "sanity";

import { isProduction, isUniqueSlug, slugify } from "../utils/helper";
import { PathnameFieldComponent } from "./slug-field-component";

type DefineSlugConfig = {
  source?: string;
  group?: string;
  slugify?: SlugOptions["slugify"];
  validate?: SlugDefinition["validation"];
} & (
  | { prefix: string; slug?: never }
  | { slug: string; prefix?: never }
  | { prefix?: never; slug?: never }
);

export const defineSlugForDocument = ({
  source,
  prefix,
  slug,
  slugify: customSlugify,
  validate: customValidate,
  group,
}: DefineSlugConfig) => [
  ...(source
    ? []
    : [
        defineField({
          name: "name",
          type: "string",
          title: "Nazwa",
          ...(group ? { group } : {}),
          description:
            "Nazwa dokumentu, używana do wyświetlania w ścieżce nawigacyjnej.",
          validation: (Rule) => Rule.required().error("Nazwa jest wymagana"),
        }),
      ]),
  defineField({
    name: "slug",
    type: "slug",
    title: "Slug",
    ...(group ? { group } : {}),
    components: {
      field: (props) => <PathnameFieldComponent {...props} prefix={prefix} />,
    },
    description: (
      <span style={{ color: "var(--card-fg-color)" }}>
        Slug to unikalny identyfikator dokumentu, używany do SEO i linków.
        {isProduction() && slug && (
          <>
            {" "}
            <strong>
              <em>Ten slug nie może być zmieniony.</em>
            </strong>
          </>
        )}
      </span>
    ),
    readOnly: isProduction() && !!slug,
    options: {
      source: source || "name",
      slugify:
        customSlugify ||
        ((inputSlug, _, context) => {
          if (slug) {
            // Return predefined slug as-is
            return slug;
          }
          const currentPrefix = prefix ?? "";
          const slugified = `${currentPrefix}${slugify(inputSlug)}`;
          // Ensure leading slash if not present, and trailing slash for non-root paths
          const withLeadingSlash = slugified.startsWith("/")
            ? slugified
            : `/${slugified}`;
          return withLeadingSlash === "/"
            ? withLeadingSlash
            : `${withLeadingSlash.replace(/\/$/, "")}/`;
        }),
      isUnique: isUniqueSlug,
    },
    validation:
      customValidate ||
      ((Rule) =>
        Rule.custom(async (value, context) => {
          const currentPrefix = prefix ?? "";

          if (
            currentPrefix &&
            value?.current &&
            !value.current.startsWith(currentPrefix)
          ) {
            return `Slug powinien zaczynać się od ${currentPrefix}`;
          }

          if (slug) {
            if (value?.current !== slug) {
              return `Slug musi być dokładnie "${slug}"`;
            }
            return true;
          }

          if (prefix && value?.current) {
            const contentAfterPrefix = value.current
              .replace(currentPrefix, "")
              .trim();
            if (!contentAfterPrefix || contentAfterPrefix === "/") {
              return `Slug musi zawierać treść po ${currentPrefix}. Sam ukośnik nie wystarczy.`;
            }
          }

          // Check for trailing slash requirement (except for root)
          if (
            value?.current &&
            value.current !== "/" &&
            !value.current.endsWith("/")
          ) {
            return "Slug musi kończyć się ukośnikiem (/)";
          }

          if (
            value?.current &&
            value.current.replace(currentPrefix, "") !==
              slugify(
                value.current.replace(currentPrefix, "").replace(/\/$/, ""),
              ) +
                (value.current === "/" ? "" : "/")
          ) {
            return "W slugu jest literówka. Pamiętaj, że slug może zawierać tylko małe litery, cyfry i myślniki, oraz musi kończyć się ukośnikiem.";
          }
          return true;
        })
          .required()
          .error("Slug jest wymagany")),
  }),
];
