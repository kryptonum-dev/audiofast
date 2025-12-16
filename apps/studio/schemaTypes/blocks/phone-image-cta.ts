import { Phone } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Zdjęcie z telefonem CTA";

export const phoneImageCta = defineType({
  name: "phoneImageCta",
  icon: Phone,
  type: "object",
  title,
  description:
    "Sekcja z zdjęciem, dwoma nagłówkami, opisami, przyciskiem CTA i numerem telefonu",
  fields: [
    defineField({
      name: "image",
      title: "Zdjęcie",
      type: "image",
      description: "Główne zdjęcie sekcji",
      validation: (Rule) => Rule.required().error("Zdjęcie jest wymagane"),
      options: {
        hotspot: true,
      },
    }),
    customPortableText({
      name: "primaryHeading",
      title: "Nagłówek główny",
      description: "Główny nagłówek sekcji",
      type: "heading",
    }),
    customPortableText({
      name: "primaryDescription",
      title: "Opis główny",
      description: "Główny opis sekcji",
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    defineField({
      name: "ctaButton",
      title: "Przycisk CTA",
      type: "buttonWithNoVariant",
      description: "Przycisk Call-to-Action",
      validation: (Rule) => Rule.required().error("Przycisk CTA jest wymagany"),
    }),
    customPortableText({
      name: "secondaryHeading",
      title: "Nagłówek dodatkowy",
      description: "Dodatkowy nagłówek sekcji",
      type: "heading",
    }),
    customPortableText({
      name: "secondaryDescription",
      title: "Opis dodatkowy",
      description: "Dodatkowy opis sekcji",
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    defineField({
      name: "phoneNumber",
      title: "Numer telefonu",
      type: "string",
      description: "Numer telefonu w formacie +48 XXX XXX XXX",
      validation: (Rule) => [
        Rule.required().error("Numer telefonu jest wymagany"),
        Rule.custom((value) => {
          if (!value) return true;
          // Basic phone number validation
          const phoneRegex = /^\+?[0-9\s\-()]+$/;
          return (
            phoneRegex.test(value) || "Nieprawidłowy format numeru telefonu"
          );
        }),
      ],
    }),
  ],
  preview: {
    select: {
      primaryHeading: "primaryHeading",
    },
    prepare: ({ primaryHeading }) => {
      return {
        title,
        subtitle: toPlainText(primaryHeading),
        media: Phone,
      };
    },
  },
});
