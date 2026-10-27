import {
  dataSanity,
  type ScopedDataAttribute,
} from '@/src/global/sanity/data-attribute';
import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../portableText';
import Image from '../../shared/Image';
import styles from './styles.module.scss';

type GallerySectionProps = PagebuilderType<'gallerySection'> & {
  index: number;
  /** Draft only: pre-scoped to this block; `images[]` items are draggable. */
  dataAttribute?: ScopedDataAttribute;
};

export default function GallerySection({
  heading,
  description,
  images,
  index,
  dataAttribute,
}: GallerySectionProps) {
  return (
    <section className={`${styles.gallerySection} max-width`}>
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
          className={styles.heading}
        />
        <PortableText
          value={description}
          enablePortableTextStyles
          className={styles.description}
        />
      </header>
      <div className={styles.gallery}>
        {images?.map((image, idx) => (
          <div
            key={image._key ?? `${image.id}-${idx}`}
            className={styles.galleryItem}
            data-sanity={
              image._key
                ? dataSanity(dataAttribute, ['images', { _key: image._key }])
                : undefined
            }
          >
            <Image
              image={image}
              sizes="(max-width: 27.4375rem) 96vw, (max-width: 37.4375rem) 47vw, (max-width: 56.1875rem) 41vw, (max-width: 85.375rem) 32vw, 430px"
              priority={index === 0 && idx === 0}
              loading={index === 0 ? 'eager' : 'lazy'}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
