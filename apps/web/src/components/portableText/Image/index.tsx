import type { PortableTextTypeComponentProps } from 'next-sanity';

import type { PortableTextProps } from '@/src/global/types';

import Image from '../../shared/Image';
import PortableText from '../index';
import styles from './styles.module.scss';

type ImageValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptImage';
  layout?: 'single' | 'double';
};

export function ImageComponent({
  value,
}: PortableTextTypeComponentProps<ImageValue>) {
  const { caption, image, layout, image1, image2 } = value;
  const isDouble = layout === 'double';

  console.log(image1, image2);

  const singleImageSizes =
    '(max-width: 37.4375rem) 96vw, (max-width: 56.125rem) 83vw, (max-width: 69.3125rem) 768px, 704px';
  const doubleImageSizes =
    '(max-width: 37.4375rem) 96vw, (max-width: 56.125rem) 42vw, (max-width: 69.3125rem) 384px, 352px';

  // Double image layout
  if (isDouble) {
    if (!caption) {
      return (
        <div className={styles.doubleWrapper} data-no-wrapper>
          <Image
            image={image1}
            className={styles.doubleImage}
            sizes={doubleImageSizes}
            loading="lazy"
          />
          <Image
            image={image2}
            className={styles.doubleImage}
            sizes={doubleImageSizes}
            loading="lazy"
          />
        </div>
      );
    }

    return (
      <figure className={styles.wrapper}>
        <div className={styles.doubleWrapper}>
          <Image image={image1} sizes={doubleImageSizes} loading="lazy" />
          <Image image={image2} sizes={doubleImageSizes} loading="lazy" />
        </div>
        <figcaption className={styles.caption}>
          <PortableText value={caption} />
        </figcaption>
      </figure>
    );
  }

  // Single image layout
  if (!caption) {
    return (
      <Image
        image={image}
        className={styles.image}
        sizes={singleImageSizes}
        loading="lazy"
        data-no-wrapper
      />
    );
  }

  return (
    <figure className={styles.wrapper}>
      <Image
        image={image}
        className={styles.image}
        sizes={singleImageSizes}
        loading="lazy"
      />
      <figcaption className={styles.caption}>
        <PortableText value={caption} />
      </figcaption>
    </figure>
  );
}
