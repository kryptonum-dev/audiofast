import type { PagebuilderType } from "@/src/global/types";

import PortableText from "../../portableText";
import type { AppImageProps } from "../../shared/Image";
import GrayImageCtaCard from "../../ui/GrayImageCtaCard";
import TeamMemberCard from "../../ui/TeamMemberCard";
import styles from "./styles.module.scss";

type TeamSectionProps = PagebuilderType<"teamSection"> & {
  index: number;
};

export default function TeamSection({
  heading,
  description,
  teamMembers,
  secondaryHeading,
  secondaryDescription,
  ctaButton,
  index,
}: TeamSectionProps) {
  return (
    <section className={`${styles.teamSection} max-width`}>
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? "h1" : "h2"}
          className={styles.heading}
        />
        <PortableText
          value={description}
          enablePortableTextStyles
          className={styles.description}
        />
      </header>
      <GrayImageCtaCard
        image={teamMembers![0]!.image as unknown as AppImageProps}
        primaryHeading={secondaryHeading}
        primaryDescription={secondaryDescription}
        secondaryHeading={teamMembers![0]!.name!}
        secondaryDescription={teamMembers![0]!.description!}
        button={ctaButton!}
        index={index}
        phoneNumber={teamMembers![0]!.phoneNumber!}
      />
      {teamMembers && teamMembers.length > 1 && (
        <ul className={styles.teamMembers}>
          {teamMembers.slice(1).map((member) => (
            <TeamMemberCard
              isListItem
              key={member._id}
              member={member}
              headingLevel={index === 0 ? "h3" : "h4"}
              imageSizes="400px"
              index={index}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
