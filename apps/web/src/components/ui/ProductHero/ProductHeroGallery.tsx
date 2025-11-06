'use client';

import { useCallback, useState } from 'react';

import type { SanityRawImage } from '@/components/shared/Image';
import Image from '@/components/shared/Image';

import styles from './styles.module.scss';

interface ProductHeroGalleryProps {
  images: SanityRawImage[];
}

export default function ProductHeroGallery({
  images,
}: ProductHeroGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleThumbnailClick = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  if (!images || images.length === 0) return null;

  const currentImage = images[selectedIndex];

  return (
    <div className={styles.galleryWrapper}>
      {/* Main Image */}
      <div className={styles.mainImage}>
        {currentImage ? (
          <Image
            image={currentImage}
            sizes="(max-width: 56.1875rem) 96vw, (max-width: 85.375rem) 50vw, 650px"
            priority={selectedIndex === 0}
            loading={selectedIndex === 0 ? 'eager' : 'lazy'}
            alt={currentImage.alt || `Product image ${selectedIndex + 1}`}
          />
        ) : (
          <div className={styles.placeholder}>Brak zdjęcia</div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className={styles.thumbnails}>
          {images.map((image, index) => (
            <button
              key={index}
              type="button"
              className={`${styles.thumbnail} ${
                index === selectedIndex ? styles.active : ''
              }`}
              onClick={() => handleThumbnailClick(index)}
              aria-label={`Przejdź do zdjęcia ${index + 1}`}
            >
              {image ? (
                <Image
                  image={image}
                  sizes="80px"
                  loading="lazy"
                  alt={image.alt || `Thumbnail ${index + 1}`}
                />
              ) : (
                <div className={styles.thumbnailPlaceholder} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
