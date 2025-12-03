import type { PagebuilderType } from "@/src/global/types";

import type { AppImageProps } from "../../shared/Image";
import GrayImageCtaCard from "../../ui/GrayImageCtaCard";
import styles from "./styles.module.scss";

type PhoneImageCtaProps = PagebuilderType<"phoneImageCta"> & {
  index: number;
};

export default function PhoneImageCta({
  image,
  primaryHeading,
  primaryDescription,
  ctaButton,
  secondaryHeading,
  secondaryDescription,
  phoneNumber,
  index,
}: PhoneImageCtaProps) {
  return (
    <section className={`${styles.phoneImageCta} max-width`}>
      <GrayImageCtaCard
        image={image as unknown as AppImageProps}
        primaryHeading={primaryHeading}
        primaryDescription={primaryDescription}
        button={ctaButton!}
        secondaryHeading={secondaryHeading}
        secondaryDescription={secondaryDescription}
        phoneNumber={phoneNumber!}
        index={index}
      />
    </section>
  );
}
