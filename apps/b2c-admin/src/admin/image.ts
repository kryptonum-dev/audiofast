import { sanityAppConfig } from "../config.js";

export type AdminProductImage = {
  id?: string | null;
  preview?: string | null;
  alt?: string | null;
  naturalWidth?: number | null;
  naturalHeight?: number | null;
};

type SanityImageUrlOptions = {
  height?: number;
  quality?: number;
  scale?: number;
  width?: number;
};

function buildSanityAssetPath(imageId: string): string | null {
  const match = /^image-([a-f0-9]+)-(\d+x\d+)-([a-z0-9]+)$/i.exec(imageId);

  if (!match) {
    return null;
  }

  const [, assetId, dimensions, extension] = match;
  return `${assetId}-${dimensions}.${extension}`;
}

function normalizeImageDimension(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return fallback;
  }

  return Math.ceil(value);
}

export function buildSanityImageUrl(
  image: AdminProductImage | null | undefined,
  options: SanityImageUrlOptions = {},
): string | null {
  if (!image?.id) {
    return null;
  }

  const assetPath = buildSanityAssetPath(image.id);

  if (!assetPath) {
    return null;
  }

  const width = normalizeImageDimension(options.width, 96);
  const height = normalizeImageDimension(options.height, width);
  const scale = normalizeImageDimension(options.scale, 1);
  const quality = normalizeImageDimension(options.quality, 85);

  const params = new URLSearchParams({
    w: String(width * scale),
    h: String(height * scale),
    fit: "fill",
    bg: "ffffff",
    fm: "webp",
    q: String(quality),
  });

  return `https://cdn.sanity.io/images/${sanityAppConfig.projectId}/${sanityAppConfig.dataset}/${assetPath}?${params}`;
}

export function buildSanityImageAssetUrl(
  image: AdminProductImage | null | undefined,
): string | null {
  if (!image?.id) {
    return null;
  }

  const assetPath = buildSanityAssetPath(image.id);

  if (!assetPath) {
    return null;
  }

  return `https://cdn.sanity.io/images/${sanityAppConfig.projectId}/${sanityAppConfig.dataset}/${assetPath}`;
}
