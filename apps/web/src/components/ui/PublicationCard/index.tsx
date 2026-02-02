import Link from "next/link";

import type { PublicationType as PublicationTypeProps } from "@/src/global/types";
import { portableTextToPlainString } from "@/src/global/utils";

import Image from "../../shared/Image";
import Button from "../Button";
import DateBox from "../DateBox";
import PublicationType from "../PublicationType";
import styles from "./styles.module.scss";

type PublicationCardProps = {
  publication: PublicationTypeProps;
  layout?: "vertical" | "horizontal";
  headingLevel?: "h2" | "h3";
  imageSizes?: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
};

export default function PublicationCard({
  publication,
  layout = "vertical",
  imageSizes = "400px",
  headingLevel = "h3",
  priority = false,
  loading = "lazy",
}: PublicationCardProps) {
  const {
    _type,
    _createdAt,
    publishDate,
    slug,
    title,
    name,
    image,
    publicationType,
    openInNewTab,
  } = publication;

  const Heading = headingLevel;

  // Products use name field instead of portable text title
  const isProduct = _type === "product";
  const displayTitle = isProduct ? name : portableTextToPlainString(title);

  // Determine button text based on publication type
  const buttonText = isProduct ? "Zobacz produkt" : "Czytaj artykuł";

  return (
    <article className={styles.publicationCard} data-layout={layout}>
      <Link
        href={slug!}
        className={styles.link}
        {...(openInNewTab && { target: "_blank", rel: "noopener noreferrer" })}
      >
        <div className={styles.imageBox}>
          <Image
            image={image}
            sizes={imageSizes}
            priority={priority}
            loading={loading}
          />
        </div>
        <div className={styles.content}>
          <PublicationType publicationType={publicationType!} />
          <DateBox date={publishDate || _createdAt} />
          <Heading className={styles.title}>{displayTitle}</Heading>
          {layout === "vertical" && (
            <Button tabIndex={-1} text={buttonText} variant="primary" />
          )}
        </div>
      </Link>
    </article>
  );
}
