import type { PortableTextProps } from '@/src/global/types';

import PortableText from '../../portableText';
import Image, { type AppImageProps } from '../../shared/Image';
import type { Props as ButtonProps } from '../../ui/Button/Button';
import Button from '../../ui/Button/Button';
import PhoneLink from '../PhoneLink';
import styles from './styles.module.scss';

type GrayImageCtaCardProps = {
  image: AppImageProps;
  primaryHeading: PortableTextProps;
  primaryDescription: PortableTextProps;
  secondaryHeading: PortableTextProps | string;
  secondaryDescription: PortableTextProps;
  button: ButtonProps;
  index: number;
  phoneNumber: string;
};

export default function GrayImageCtaCard({
  image,
  primaryHeading,
  primaryDescription,
  secondaryHeading,
  secondaryDescription,
  button,
  index,
  phoneNumber,
}: GrayImageCtaCardProps) {
  const SecondaryHeadingLevel = index === 0 ? 'h3' : 'h4';
  return (
    <div className={styles.grayImageCtaCard}>
      <Image
        image={image}
        sizes="(max-width: 37.4375rem) 92vw, (max-width: 56.1875rem) 80vw, (max-width: 83.625rem) 50vw, 627px"
        priority={index === 0}
        loading={index === 0 ? 'eager' : 'lazy'}
      />
      <PortableText
        value={primaryHeading}
        headingLevel={index === 0 ? 'h2' : 'h3'}
        className={styles.primaryHeading}
      />
      <PortableText
        value={primaryDescription}
        className={styles.primaryDescription}
        enablePortableTextStyles
      />
      <Button {...button} />
      {typeof secondaryHeading === 'string' ? (
        <SecondaryHeadingLevel className={styles.secondaryHeading}>
          {secondaryHeading}
        </SecondaryHeadingLevel>
      ) : (
        <PortableText
          value={secondaryHeading}
          headingLevel={SecondaryHeadingLevel}
          className={styles.secondaryHeading}
        />
      )}
      <PortableText
        value={secondaryDescription}
        className={styles.secondaryDescription}
        enablePortableTextStyles
      />
      <PhoneLink phoneNumber={phoneNumber} />
    </div>
  );
}
