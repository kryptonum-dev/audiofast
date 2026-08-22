import type { TeamMemberType } from '@/src/global/types';

import PortableText from '../../portableText';
import Image from '../../shared/Image';
import PhoneLink from '../PhoneLink';
import styles from './styles.module.scss';

interface TeamMemberCardProps {
  member: TeamMemberType;
  headingLevel?: 'h2' | 'h3' | 'h4';
  imageSizes?: string;
  index: number;
  isListItem?: boolean;
}

export default function TeamMemberCard({
  member,
  imageSizes = '400px',
  headingLevel = 'h3',
  index,
  isListItem = false,
}: TeamMemberCardProps) {
  const { name, position, phoneNumber, image, description } = member;

  const Heading = headingLevel;

  const Wrapper = isListItem ? 'li' : 'div';

  return (
    <Wrapper className={styles.teamMemberCard}>
      <Image
        image={image}
        sizes={imageSizes}
        loading={index === 0 ? 'eager' : 'lazy'}
      />
      <Heading className={styles.name}>{name}</Heading>
      <p className={styles.position}>{position}</p>
      <PhoneLink phoneNumber={phoneNumber!} />
      <PortableText
        value={description}
        enablePortableTextStyles
        className={styles.description}
      />
    </Wrapper>
  );
}
