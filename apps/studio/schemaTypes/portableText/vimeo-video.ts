import { VideoIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

export const ptVimeoVideo = defineType({
  name: "ptVimeoVideo",
  type: "object",
  title: "Wideo Vimeo",
  icon: VideoIcon,
  description: "Osadź wideo Vimeo z miniaturą i przyciskiem odtwarzania",
  fields: [
    defineField({
      name: "vimeoId",
      title: "ID wideo Vimeo",
      type: "string",
      description:
        "Wprowadź ID wideo Vimeo (np. dla https://vimeo.com/328584595, ID to: 328584595)",
      validation: (Rule) =>
        Rule.required().error("ID wideo Vimeo jest wymagane"),
    }),
    defineField({
      name: "title",
      title: "Tytuł wideo",
      type: "string",
      description:
        "Tytuł wyświetlany w prawym górnym rogu miniaturki (opcjonalne).",
    }),
    defineField({
      name: "thumbnail",
      title: "Miniatura wideo",
      type: "image",
      description:
        "Opcjonalna miniatura wideo. Jeśli nie zostanie wybrana, zostanie użyta domyślna miniatura Vimeo.",
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: {
      vimeoId: "vimeoId",
      title: "title",
      thumbnail: "thumbnail",
    },
    prepare: ({ vimeoId, title, thumbnail }) => ({
      title: title || "Wideo Vimeo",
      subtitle: vimeoId ? `ID: ${vimeoId}` : "Brak ID",
      media: thumbnail || VideoIcon,
    }),
  },
});
