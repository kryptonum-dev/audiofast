import { LinkIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

export const ptButton = defineType({
  name: "ptButton",
  type: "object",
  title: "Przycisk",
  icon: LinkIcon,
  fields: [
    defineField({
      name: "button",
      title: "Przycisk",
      type: "button",
      description: "Konfiguracja przycisku",
      validation: (Rule) => Rule.required().error("Przycisk jest wymagany"),
    }),
  ],
  preview: {
    select: {
      text: "button.text",
      variant: "button.variant",
      urlType: "button.url.type",
      externalUrl: "button.url.external",
      internalUrl: "button.url.internal.slug.current",
    },
    prepare: ({ text, variant, urlType, externalUrl, internalUrl }) => {
      const url = urlType === "external" ? externalUrl : internalUrl;
      const truncatedUrl =
        url?.length > 30 ? `${url.substring(0, 30)}...` : url;
      const variantLabel = variant === "primary" ? "Główny" : "Drugorzędny";
      return {
        title: text || "Przycisk",
        subtitle: `${variantLabel} • ${truncatedUrl || "(brak linku)"}`,
        media: LinkIcon,
      };
    },
  },
});
