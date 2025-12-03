import type { PagebuilderType } from "@/src/global/types";

import PortableText from "../../portableText";
import Button from "../../ui/Button";
import PublicationsCarousel from "./PublicationsCarousel";
import styles from "./styles.module.scss";

type FeaturedPublicationsProps = PagebuilderType<"featuredPublications"> & {
  index: number;
  publicationLayout?: "vertical" | "horizontal";
  customId?: string;
  isButtonVisible?: boolean;
};

export default function FeaturedPublications({
  customId,
  heading,
  button,
  publications,
  index,
  publicationLayout = "horizontal",
  isButtonVisible = true,
}: FeaturedPublicationsProps) {
  return (
    <section
      id={customId}
      className={`${styles.featuredPublications} max-width-block`}
    >
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? "h1" : "h2"}
          className={styles.heading}
        />
        {isButtonVisible && <Button {...button} />}
      </header>
      <PublicationsCarousel
        publications={publications!}
        index={index}
        publicationLayout={publicationLayout}
      />
    </section>
  );
}
