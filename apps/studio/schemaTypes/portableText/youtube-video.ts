import { VideoIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

export const ptYoutubeVideo = defineType({
  name: "ptYoutubeVideo",
  type: "object",
  title: "Wideo YouTube",
  icon: VideoIcon,
  description: "Osadź wideo YouTube z miniaturą i przyciskiem odtwarzania",
  fields: [
    defineField({
      name: "youtubeId",
      title: "ID wideo YouTube",
      type: "string",
      description:
        "Wprowadź ID wideo YouTube (np. dla https://www.youtube.com/watch?v=dQw4w9WgXcQ, ID to: dQw4w9WgXcQ)",
      validation: (Rule) =>
        Rule.required().error("ID wideo YouTube jest wymagane"),
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
        "Opcjonalna miniatura wideo. Jeśli nie zostanie wybrana, zostanie użyta domyślna miniatura YouTube.",
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: {
      youtubeId: "youtubeId",
      title: "title",
      thumbnail: "thumbnail",
    },
    prepare: ({ youtubeId, title, thumbnail }) => ({
      title: title || "Wideo YouTube",
      subtitle: youtubeId ? `ID: ${youtubeId}` : "Brak ID",
      media: thumbnail || VideoIcon,
    }),
  },
});
