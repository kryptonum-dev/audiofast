import { PlayCircle } from "lucide-react";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "../portableText";

const title = "Obraz z wideo";

export const imageWithVideo = defineType({
  name: "imageWithVideo",
  title,
  icon: PlayCircle,
  type: "object",
  description:
    "Sekcja wyświetlająca obraz z opcjonalnym wideo YouTube. Po kliknięciu przycisku odtwarzania otwiera się modal z wideo.",
  fields: [
    defineField({
      name: "image",
      title: "Obraz",
      type: "image",
      description:
        "Główny obraz sekcji. Będzie wyświetlany jako tło z opcjonalnym przyciskiem odtwarzania wideo.",
      validation: (Rule) =>
        Rule.required().error("Obraz jest wymagany dla tej sekcji"),
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: "youtubeId",
      title: "ID wideo YouTube",
      type: "string",
      description:
        'Opcjonalny identyfikator wideo z YouTube (np. "dQw4w9WgXcQ" z URL youtube.com/watch?v=dQw4w9WgXcQ). Po podaniu ID pojawi się przycisk odtwarzania na obrazie.',
      validation: (Rule) =>
        Rule.custom((value: string | undefined) => {
          if (!value) return true;
          // Basic YouTube ID validation (11 characters, alphanumeric + dash + underscore)
          const youtubeIdPattern = /^[a-zA-Z0-9_-]{11}$/;
          if (!youtubeIdPattern.test(value)) {
            return "ID wideo YouTube powinno mieć 11 znaków (litery, cyfry, myślniki i podkreślenia)";
          }
          return true;
        }),
    }),
    customPortableText({
      name: "heading",
      title: "Nagłówek sekcji",
      type: "heading",
      validation: (Rule) =>
        Rule.required().error("Nagłówek sekcji jest wymagany"),
    }),
    customPortableText({
      name: "description",
      title: "Opis sekcji",
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
      validation: (Rule) => Rule.required().error("Opis sekcji jest wymagany"),
    }),
    defineField({
      name: "button",
      title: "Przycisk CTA",
      type: "buttonWithNoVariant",
      validation: (Rule) =>
        Rule.required().error("Przycisk CTA jest wymagany dla tej sekcji"),
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
        media: PlayCircle,
      };
    },
  },
});
