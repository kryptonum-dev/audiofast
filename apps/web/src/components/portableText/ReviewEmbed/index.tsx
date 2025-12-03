import type { PortableTextTypeComponentProps } from "next-sanity";

import type { PortableTextProps } from "@/src/global/types";
import { portableTextToPlainString } from "@/src/global/utils";

import PortableText from "../../portableText";
import type { SanityRawImage } from "../../shared/Image";
import Image from "../../shared/Image";
import Button from "../../ui/Button";
import styles from "./styles.module.scss";

type ReviewEmbedValue = {
  _type: "ptReviewEmbed";
  review: {
    _id?: string;
    title?: PortableTextProps;
    slug?: string;
    image?: SanityRawImage;
    description?: PortableTextProps;
  };
};

export function ReviewEmbedComponent({
  value,
}: PortableTextTypeComponentProps<ReviewEmbedValue>) {
  const { review } = value;

  const title = review.title ? portableTextToPlainString(review.title) : "";

  const reviewUrl = review.slug || "#";

  return (
    <aside className={styles.reviewEmbed}>
      <a href={reviewUrl} className={styles.link}>
        {review.image && (
          <Image image={review.image} sizes="180px" loading="lazy" />
        )}
        <h4 className={styles.title}>{title}</h4>
        {review.description && (
          <PortableText
            value={review.description}
            enablePortableTextStyles
            className={styles.description}
          />
        )}
        <Button
          tabIndex={-1}
          text="czytaj dalej..."
          variant="primary"
          className={styles.button}
        />
      </a>
    </aside>
  );
}
