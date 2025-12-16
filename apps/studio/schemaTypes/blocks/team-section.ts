import { Users } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Sekcja zespołu";

export const teamSection = defineType({
  name: "teamSection",
  title,
  icon: Users,
  type: "object",
  description:
    "Sekcja prezentująca zespół Audiofast lub ogólną informację kontaktową z przyciskiem CTA",
  fields: [
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      description: 'Główny nagłówek sekcji (np. "Poznaj naszych ekspertów")',
      type: "heading",
    }),
    customPortableText({
      name: "description",
      title: "Opis sekcji",
      description: "Krótki opis wyświetlany pod nagłówkiem",
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    customPortableText({
      name: "secondaryHeading",
      title: "Nagłówek dodatkowy",
      description: "Dodatkowy nagłówek wyświetlany w karcie głównej CTA",
      type: "heading",
      validation: (Rule) =>
        Rule.required().error("Nagłówek dodatkowy jest wymagany"),
    }),
    customPortableText({
      name: "secondaryDescription",
      title: "Opis dodatkowy",
      description: "Dodatkowy tekst opisowy wyświetlany w karcie głównej CTA",
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
      validation: (Rule) =>
        Rule.required().error("Opis dodatkowy jest wymagany"),
    }),
    defineField({
      name: "ctaButton",
      title: "Przycisk CTA",
      type: "buttonWithNoVariant",
      description: "Przycisk call-to-action wyświetlany w karcie głównej CTA",
      validation: (Rule) => Rule.required().error("Przycisk CTA jest wymagany"),
    }),

    defineField({
      name: "teamMembers",
      title: "Członkowie zespołu",
      type: "array",
      description:
        "Wybierz członków zespołu do wyświetlenia (minimum 1, maksimum 4)",
      of: [
        {
          type: "reference",
          to: [{ type: "teamMember" }],
          options: {
            disableNew: true,
            filter: ({ parent }) => {
              const selectedIds =
                (parent as { _ref?: string }[])
                  ?.filter((item) => item._ref)
                  .map((item) => item._ref) || [];

              return {
                filter: '!(_id in $selectedIds) && !(_id in path("drafts.**"))',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.required()
          .error("Musisz dodać co najmniej 1 członka zespołu")
          .max(4)
          .error("Możesz dodać maksimum 4 członków zespołu"),
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
        media: Users,
      };
    },
  },
});
