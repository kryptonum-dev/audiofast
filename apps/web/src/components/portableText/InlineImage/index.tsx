import type { PortableTextTypeComponentProps } from "next-sanity";

import type { SanityRawImage } from "../../shared/Image";
import Image from "../../shared/Image";
import styles from "./styles.module.scss";

type InlineImageValue = {
  _type: "ptInlineImage";
  float?: "left" | "right";
  alt?: string;
  width?: number;
  image: SanityRawImage;
};

export function InlineImageComponent({
  value,
}: PortableTextTypeComponentProps<InlineImageValue>) {
  const { image, float, alt, width } = value;

  if (!image) {
    return null;
  }

  // Use fixed width if provided, otherwise responsive
  const imageSizes = width
    ? `${width}px`
    : "(max-width: 56.1875rem) 40vw, 300px";

  // Create inline style for fixed width
  const inlineStyle = width
    ? { width: `${width}px`, maxWidth: `${width}px` }
    : undefined;

  return (
    <Image
      image={image}
      className={`${styles.inlineImage} ${float === "right" ? styles.floatRight : styles.floatLeft}`}
      style={inlineStyle}
      sizes={imageSizes}
      loading="lazy"
      alt={alt}
      data-no-wrapper
    />
  );
}
