import { sanityAppConfig } from "../config.js";

type AdminProductImage = {
  id?: string | null;
  alt?: string | null;
  naturalWidth?: number | null;
  naturalHeight?: number | null;
};

export function buildSanityImageUrl(
  image: AdminProductImage | null | undefined,
): string | null {
  if (!image?.id) {
    return null;
  }

  const assetPath = image.id
    .replace(/^image-/, "")
    .replace(/-([a-z0-9]+)$/i, ".$1");

  return `https://cdn.sanity.io/images/${sanityAppConfig.projectId}/${sanityAppConfig.dataset}/${assetPath}?w=96&h=96&fit=crop&auto=format`;
}
