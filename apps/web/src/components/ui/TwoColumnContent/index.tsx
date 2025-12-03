import type { SanityRawImage } from "@/components/shared/Image";
import Image from "@/components/shared/Image";
import type { QueryBrandBySlugResult } from "@/src/global/sanity/sanity.types";
import type { PortableTextProps } from "@/src/global/types";

import PortableText from "../../portableText";
import ContentBlocks, { type ContentBlock } from "../ContentBlocks";
import ProductGallery from "../ProductGallery";
import styles from "./styles.module.scss";

export interface TwoColumnContentProps {
  // New content blocks format (for brand pages)
  contentBlocks?: ContentBlock[] | null;
  // Legacy portable text format (for backward compatibility)
  content?: PortableTextProps;
  // Custom heading - can be PortableText or string. Defaults to "O marce" if not provided.
  heading?: PortableTextProps | string;
  customId?: string;
  distributionYear?: NonNullable<QueryBrandBySlugResult>["distributionYear"];
  gallery?: SanityRawImage[];
  className?: string;
}

export default function TwoColumnContent({
  contentBlocks,
  content,
  heading = "O marce",
  customId,
  distributionYear,
  gallery,
  className,
}: TwoColumnContentProps) {
  // Check if we have content to render
  const hasContentBlocks =
    contentBlocks && Array.isArray(contentBlocks) && contentBlocks.length > 0;
  const hasLegacyContent =
    content && Array.isArray(content) && content.length > 0;

  if (!hasContentBlocks && !hasLegacyContent) {
    return null;
  }

  console.log("contentBlocks", contentBlocks);

  // Render heading - either as PortableText or plain string
  const renderHeading = () => {
    if (typeof heading === "string") {
      return heading;
    }
    // PortableText heading
    if (Array.isArray(heading) && heading.length > 0) {
      return <PortableText value={heading} />;
    }
    return "O marce";
  };

  return (
    <section
      className={`max-width-block ${styles.twoColumnContent} ${className || ""}`}
      id={customId || undefined}
    >
      <h2 className={styles.heading}>{renderHeading()}</h2>

      {/* New content blocks format */}
      {hasContentBlocks && (
        <ContentBlocks
          blocks={contentBlocks}
          className={styles.contentWrapper}
        />
      )}

      {/* Legacy portable text format (fallback) */}
      {!hasContentBlocks && hasLegacyContent && (
        <div className={styles.contentWrapper}>
          <PortableText
            value={content}
            enablePortableTextStyles
            className={styles.content}
          />
        </div>
      )}

      {distributionYear && (
        <div className={styles.distributionYearBadge}>
          <Image
            image={distributionYear.backgroundImage}
            sizes="(max-width: 37.4375rem) 96vw, (max-width: 85.375rem) 90vw, 1238px"
            loading="lazy"
            fill
          />
          <h3>
            Jesteśmy oficjalnym dystrybutorem tej marki od{" "}
            {distributionYear.year} roku.
          </h3>
        </div>
      )}
      {gallery && (
        <ProductGallery images={gallery} customId="galeria" isSection={false} />
      )}
    </section>
  );
}
