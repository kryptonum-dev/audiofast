import type { PortableTextTypeComponentProps } from "next-sanity";

import type { PortableTextProps } from "@/src/global/types";

import Image from "../../shared/Image";
import styles from "./styles.module.scss";

type MinimalImageValue = NonNullable<PortableTextProps>[number] & {
  _type: "ptMinimalImage";
};

export function MinimalImageComponent({
  value,
}: PortableTextTypeComponentProps<MinimalImageValue>) {
  const { image } = value;

  if (!image) {
    return null;
  }

  const imageSizes =
    "(max-width: 37.4375rem) 96vw, (max-width: 56.125rem) 83vw, (max-width: 69.3125rem) 768px, 704px";

  return (
    <Image
      image={image}
      className={styles.image}
      sizes={imageSizes}
      loading="lazy"
      data-no-wrapper
    />
  );
}
