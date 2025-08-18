import { defineEnableDraftMode } from "next-sanity/draft-mode";

import { client } from "@/global/sanity/client";
import { token } from "@/global/sanity/token";

export const { GET } = defineEnableDraftMode({
  client: client.withConfig({ token }),
});
