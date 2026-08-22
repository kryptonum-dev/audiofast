import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../portableText';
import Image from '../../shared/Image';
import styles from './styles.module.scss';

type GallerySectionProps = PagebuilderType<'gallerySection'> & {
  index: number;
};

export default function GallerySection({
  heading,
  description,
  images,
  index,
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
          <div key={`${image.id}-${idx}`} className={styles.galleryItem}>
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
