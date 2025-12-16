import { TextIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "./index";

const title = "Nagłówek z ikoną";

export const ptHeading = defineType({
  name: "ptHeading",
  type: "object",
  title,
  icon: TextIcon,
  description: "Nagłówek z ikoną SVG wyświetlany po lewej stronie tekstu",
  fields: [
    defineField({
      name: "level",
      title: "Poziom nagłówka",
      type: "string",
      description: "Poziom nagłówka (zawsze H3)",
      initialValue: "h3",
      readOnly: true,
      hidden: true,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "icon",
      title: "Ikona SVG",
      type: "image",
      description:
        "Ikona SVG wyświetlana po lewej stronie nagłówka (tylko pliki SVG)",
      options: {
        accept: ".svg",
      },
      validation: (Rule) => Rule.required().error("Ikona SVG jest wymagana"),
    }),
    customPortableText({
      name: "text",
      title: "Tekst nagłówka",
      description: "Wprowadź tekst nagłówka",
      include: {
        styles: ["normal"],
        decorators: ["strong"],
        annotations: [],
      },
      validation: (Rule) =>
        Rule.required().error("Tekst nagłówka jest wymagany"),
    }),
  ],
  preview: {
    select: {
      level: "level",
      text: "text",
      icon: "icon",
    },
    prepare: ({ text, icon }) => ({
      title: toPlainText(text),
      subtitle: title,
      media: icon || TextIcon,
    }),
  },
});
