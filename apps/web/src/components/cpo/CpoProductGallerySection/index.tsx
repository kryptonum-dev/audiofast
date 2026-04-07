import type { SanityRawImage } from '@/src/components/shared/Image';

import ProductGallery from '../../ui/ProductGallery';
import styles from './styles.module.scss';

type CpoProductGallerySectionProps = {
  images?: SanityRawImage[] | null;
  customId?: string;
  heading?: string;
};

export default function CpoProductGallerySection({
  images,
  customId,
  heading = 'Galeria',
}: CpoProductGallerySectionProps) {
  if (!images || images.length === 0) return null;

  return (
    <section
      className={`${styles.cpoProductGallerySection} max-width-block`}
      id={customId}
    >
      <h2 className={styles.heading}>{heading}</h2>
      <ProductGallery images={images} isSection={false} />
    </section>
  );
}
