import type { PortableTextTypeComponentProps } from 'next-sanity';

import type { PortableTextProps } from '@/src/global/types';

import Image from '../../shared/Image';
import PortableText from '../index';
import styles from './styles.module.scss';

type ImageValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptImage';
};

export function ImageComponent({
  value,
}: PortableTextTypeComponentProps<ImageValue>) {
  const { caption, image } = value;
  const sizes =
    '(max-width: 37.4375rem) 96vw, (max-width: 56.125rem) 83vw, (max-width: 69.3125rem) 768px, 704px';
  if (!caption)
    return (
      <Image
        image={image}
        className={styles.image}
        sizes={sizes}
        loading="lazy"
        data-no-wrapper
      />
    );

  return (
    <figure className={styles.wrapper}>
      <Image
        image={image}
        className={styles.image}
        sizes={sizes}
        loading="lazy"
      />
      <figcaption className={styles.caption}>
        <PortableText value={caption} />
      </figcaption>
    </figure>
  );
}
