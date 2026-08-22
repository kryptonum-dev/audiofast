import type { PortableTextTypeComponentProps } from '@portabletext/react';

import { PortableTextRenderer } from '@/src/components/portableText';
import type { PortableTextProps } from '@/src/global/types';
import svgToInlineString from '@/src/global/utils';

import styles from './styles.module.scss';

type HeadingValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptHeading';
  level?: 'h3';
  iconUrl?: string;
  text: PortableTextProps;
};

export async function HeadingComponent({
  value,
}: PortableTextTypeComponentProps<HeadingValue>) {
  const { iconUrl, text } = value;

  const svgContent = await svgToInlineString(iconUrl);

  return (
    <div className={styles.headingWrapper}>
      {svgContent && (
        <div
          className={styles.icon}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      )}
      <PortableTextRenderer value={text} headingLevel="h3" />
    </div>
  );
}
