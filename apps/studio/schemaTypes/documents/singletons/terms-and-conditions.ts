import { FileArchive } from "lucide-react";
import { defineType } from "sanity";

import { defineSlugForDocument } from "../../../components/define-slug-for-document";
import { GROUP, GROUPS } from "../../../utils/constant";
import { customPortableText } from "../../portableText";
import { getSEOFields } from "../../shared/seo";

export const termsAndConditions = defineType({
  name: "termsAndConditions",
  type: "document",
  title: "Regulamin",
  icon: FileArchive,
  description:
    "Strona regulaminu określa zasady korzystania z Twojej strony internetowej lub usług. Zawiera warunki użytkowania, które użytkownicy muszą zaakceptować.",
  groups: GROUPS,
  fields: [
    ...defineSlugForDocument({
      slug: "/regulamin/",
      group: GROUP.MAIN_CONTENT,
    }),
    customPortableText({
      name: "description",
      title: "Opis",
      description: "Krótki opis regulaminu pod nagłówkiem strony",
      group: GROUP.MAIN_CONTENT,
      include: {
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    customPortableText({
      name: "content",
      title: "Treść",
      description: "Treść regulaminu",
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ["normal", "h2", "h3"],
        lists: ["bullet", "number"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
    ...getSEOFields({ exclude: ["doNotIndex", "hideFromList"] }),
  ],
  preview: {
    select: {
      name: "name",
      slug: "slug.current",
    },
    prepare: ({ name }) => ({
      title: name || "Regulamin",
      media: FileArchive,
    }),
  },
});
