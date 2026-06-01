import { useEffect, useState } from "react";

import {
  buildSanityImageAssetUrl,
  buildSanityImageUrl,
  type AdminProductImage,
} from "../image.js";

type SanityThumbnailProps = {
  alt: string;
  className: string;
  height: number;
  image: AdminProductImage | null | undefined;
  placeholderClassName: string;
  width: number;
};

export function SanityThumbnail({
  alt,
  className,
  height,
  image,
  placeholderClassName,
  width,
}: SanityThumbnailProps) {
  const cdnSource = buildSanityImageUrl(image, {
    height,
    quality: 95,
    scale: 3,
    width,
  });
  const cdnSourceSet = [1, 2, 3]
    .map((scale) => {
      const source = buildSanityImageUrl(image, {
        height,
        quality: 95,
        scale,
        width,
      });

      return source ? `${source} ${scale}x` : null;
    })
    .filter(Boolean)
    .join(", ");
  const rawAssetSource = buildSanityImageAssetUrl(image);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const source = fallbackIndex === 0 ? (cdnSource ?? rawAssetSource) : rawAssetSource;
  const sourceSet = fallbackIndex === 0 && cdnSource ? cdnSourceSet : "";

  useEffect(() => {
    setFallbackIndex(0);
  }, [cdnSource, rawAssetSource]);

  if (!source) {
    return <div className={placeholderClassName} aria-hidden="true" />;
  }

  return (
    <img
      alt={alt}
      className={className}
      decoding="async"
      height={height}
      loading="lazy"
      onError={() => {
        setFallbackIndex((currentIndex) => currentIndex + 1);
      }}
      sizes={`${width}px`}
      src={source}
      srcSet={sourceSet || undefined}
      width={width}
    />
  );
}
