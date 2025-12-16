import { Book } from "lucide-react";
import { defineType } from "sanity";

import { defineSlugForDocument } from "../../../components/define-slug-for-document";
import { GROUP, GROUPS } from "../../../utils/constant";
import { pageBuilderField } from "../../shared";
import { getSEOFields } from "../../shared/seo";

export const page = defineType({
  name: "page",
  title: "Podstrona",
  type: "document",
  icon: Book,
  description:
    "Utwórz nową stronę dla swojej witryny, taką jak 'O nas' lub 'Kontakt'. Każda strona ma swój własny adres internetowy i treść, którą możesz dostosować.",
  groups: GROUPS,
  fields: [
    ...defineSlugForDocument({
      group: GROUP.MAIN_CONTENT,
      validate: (Rule) =>
        Rule.required()
          .error("Slug URL jest wymagany dla strony")
          .custom((slug) => {
            // Check that pages don't use blog prefixes
            if (slug?.current?.startsWith("/blog")) {
              return 'Strony nie mogą używać prefiksu "/blog" - jest zarezerwowany dla treści bloga';
            }
            // Check that pages don't use marki prefixes
            if (slug?.current?.startsWith("/marki")) {
              return 'Strony nie mogą używać prefiksu "/marki" - jest zarezerwowany dla strony marek';
            }
            return true;
          }),
    }),
    pageBuilderField,
    ...getSEOFields({ exclude: ["hideFromList"] }),
  ],
  preview: {
    select: {
      name: "name",
      slug: "slug.current",
      isPrivate: "seoNoIndex",
    },
    prepare: ({ name, slug, isPrivate }) => {
      const statusEmoji = isPrivate ? "🔒" : "🌎";

      return {
        media: Book,
        title: `${name || "Nienazwana podstrona"}`,
        subtitle: `${statusEmoji} | ${slug || "no-slug"}`,
      };
    },
  },
});
