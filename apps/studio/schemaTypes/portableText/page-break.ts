import { SplitHorizontalIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

export const ptPageBreak = defineType({
  name: "ptPageBreak",
  type: "object",
  title: "Podział kolumn",
  icon: SplitHorizontalIcon,
  description:
    "Wskazuje podział treści na dwie kolumny. Treść przed tym elementem wyświetli się w lewej kolumnie, a treść po nim w prawej kolumnie.",
  fields: [
    defineField({
      name: "style",
      title: "Styl",
      type: "string",
      initialValue: "columnBreak",
      hidden: true,
      readOnly: true,
    }),
  ],
  preview: {
    prepare: () => ({
      title: "Podział kolumn",
      subtitle: "Treść przed → lewa kolumna | Treść po → prawa kolumna",
      media: SplitHorizontalIcon,
    }),
  },
});
