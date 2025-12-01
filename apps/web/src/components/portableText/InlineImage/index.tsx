import type { PortableTextTypeComponentProps } from 'next-sanity';

import type { PortableTextProps } from '@/src/global/types';

import Image from '../../shared/Image';
import styles from './styles.module.scss';

type InlineImageValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptInlineImage';
};

export function InlineImageComponent({
  value,
}: PortableTextTypeComponentProps<InlineImageValue>) {
  const { image } = value;

  if (!image) {
    return null;
  }

  const imageSizes = '200px';

  return (
    <Image
      image={image}
      className={styles.inlineImage}
      sizes={imageSizes}
      loading="lazy"
      data-no-wrapper
    />
  );
}
