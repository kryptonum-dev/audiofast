import type { PortableTextTypeComponentProps } from '@portabletext/react';

import { PortableTextRenderer } from '@/src/components/portableText';
import type { PortableTextProps } from '@/src/global/types';

import styles from './styles.module.scss';

type HeadingValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptHeading';
  level?: 'h3' | 'h4';
  icon?: {
    provider?: string;
    name?: string;
    svg?: string;
  };
};

export function HeadingComponent({
  value,
}: PortableTextTypeComponentProps<HeadingValue>) {
  const { level = 'h3', icon, text } = value;
  const HeadingTag = level as 'h3' | 'h4';

  return (
    <div className={styles.headingWrapper}>
      {icon?.svg && (
        <div
          className={styles.icon}
          dangerouslySetInnerHTML={{ __html: icon.svg }}
        />
      )}
      <HeadingTag className={styles.heading}>
        <PortableTextRenderer value={text} />
      </HeadingTag>
    </div>
  );
}
