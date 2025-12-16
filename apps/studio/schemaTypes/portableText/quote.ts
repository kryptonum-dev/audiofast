import { BlockquoteIcon } from "@sanity/icons";
import { defineType } from "sanity";

import { toPlainText } from "../../utils/helper";
import { customPortableText } from "./index";

export const ptQuote = defineType({
  name: "ptQuote",
  type: "object",
  title: "Cytat",
  icon: BlockquoteIcon,
  fields: [
    customPortableText({
      name: "quote",
      title: "Treść cytatu",
      description: "Wprowadź tekst cytatu z możliwością formatowania",
      include: {
        styles: ["normal"],
        decorators: ["strong", "em"],
        annotations: [],
      },
      validation: (Rule) => Rule.required().error("Treść cytatu jest wymagana"),
    }),
  ],
  preview: {
    select: {
      quote: "quote",
    },
    prepare: ({ quote }) => {
      const text = toPlainText(quote);
      return {
        title: "Cytat",
        subtitle: text?.length > 60 ? `${text.substring(0, 60)}...` : text,
        media: BlockquoteIcon,
      };
    },
  },
});
