import type { SanityImageSource } from "@sanity/asset-utils";
import Image from "next/image";

import { urlFor } from "@/global/sanity/client";

const DEFAULT_BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mMUltCqBwABcQDWMIsO5gAAAABJRU5ErkJggg==";

type SanityHotspot = {
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
};

type SanityCrop = {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
};

/**
 * Minimal Sanity image shape we project from GROQ queries
 */
export type SanityProjectedImage = {
  readonly id: string; // asset _ref
  readonly preview?: string; // LQIP
  readonly alt?: string;
  readonly hotspot?: SanityHotspot;
  readonly crop?: SanityCrop;
};

// Raw image as returned from GROQ `imageFields` (nullable fields allowed)
export type SanityRawImage = {
  readonly id?: string | null;
  readonly preview?: string | null;
  readonly alt?: string | null;
  readonly naturalWidth?: number | null;
  readonly naturalHeight?: number | null;
  readonly hotspot?: {
    readonly x?: number | null;
    readonly y?: number | null;
    readonly width?: number | null;
    readonly height?: number | null;
  } | null;
  readonly crop?: {
    readonly top?: number | null;
    readonly bottom?: number | null;
    readonly left?: number | null;
    readonly right?: number | null;
  } | null;
};

type BaseProps = {
  readonly sizes: string;
  readonly priority?: boolean;
  readonly fetchPriority?: "auto" | "high" | "low";
  readonly quality?: number;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly loading?: "eager" | "lazy";
};

export type SanityOnlyImageProps = BaseProps & {
  readonly image?: SanityRawImage | SanityProjectedImage | null;
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
  readonly fill?: boolean;
};
export type AppImageProps = SanityOnlyImageProps;

/**
 * Next.js Image with a Sanity-aware loader.
 * - Honors crop/hotspot and returns auto-formatted, width-specific URLs from Sanity CDN
 * - Uses LQIP preview as blur placeholder when available
 */
export default function AppImage(props: AppImageProps) {
  const {
    image,
    alt,
    width,
    height,
    sizes,
    priority,
    fetchPriority,
    quality,
    className,
    style,
    loading,
    fill,
  } = props;

  // Normalize raw image into a strict SanityImageSource-compatible input
  if (!image || !("id" in image) || !image.id) {
    return null;
  }

  const rawHotspot = (image as SanityRawImage).hotspot as
    | {
        x?: number | null;
        y?: number | null;
        width?: number | null;
        height?: number | null;
      }
    | undefined
    | null;

  const normalizedHotspot =
    rawHotspot &&
    typeof rawHotspot.width === "number" &&
    typeof rawHotspot.height === "number" &&
    typeof rawHotspot.x === "number" &&
    typeof rawHotspot.y === "number"
      ? {
          x: rawHotspot.x,
          y: rawHotspot.y,
          width: rawHotspot.width,
          height: rawHotspot.height,
        }
      : undefined;

  const rawCrop = (image as SanityRawImage).crop as
    | {
        top?: number | null;
        bottom?: number | null;
        left?: number | null;
        right?: number | null;
      }
    | undefined
    | null;

  const normalizedCrop =
    rawCrop &&
    typeof rawCrop.top === "number" &&
    typeof rawCrop.bottom === "number" &&
    typeof rawCrop.left === "number" &&
    typeof rawCrop.right === "number"
      ? {
          top: rawCrop.top,
          bottom: rawCrop.bottom,
          left: rawCrop.left,
          right: rawCrop.right,
        }
      : undefined;

  const sanitySource: SanityImageSource = {
    asset: { _ref: image.id as string },
    ...(normalizedCrop ? { crop: normalizedCrop } : {}),
    ...(normalizedHotspot ? { hotspot: normalizedHotspot } : {}),
  };

  let builder = urlFor(sanitySource).fit("crop").auto("format");
  const fallbackW = (image as SanityRawImage).naturalWidth ?? undefined;
  const fallbackH = (image as SanityRawImage).naturalHeight ?? undefined;
  const targetW = typeof width === "number" ? width : fallbackW;
  const targetH = typeof height === "number" ? height : fallbackH;
  if (typeof targetW === "number") builder = builder.width(targetW);
  if (typeof targetH === "number") builder = builder.height(targetH);
  const finalSrc = builder.url();

  const blurDataURL =
    (image as SanityRawImage).preview || DEFAULT_BLUR_DATA_URL;
  const placeholder = (image as SanityRawImage).preview
    ? "blur"
    : ("empty" as const);

  return (
    <Image
      src={finalSrc}
      alt={alt ?? (image as SanityRawImage).alt ?? ""}
      sizes={sizes}
      priority={priority}
      fetchPriority={fetchPriority}
      quality={quality}
      className={className}
      style={style}
      loading={loading}
      {...(fill
        ? { fill: true }
        : {
            width: targetW,
            height: targetH,
          })}
      {...(placeholder === "blur" && { placeholder, blurDataURL })}
    />
  );
}
