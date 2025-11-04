import type { SanityProjectedImage } from '@/components/shared/Image';
import AppImage from '@/components/shared/Image';

import styles from './styles.module.scss';

export interface DistributionYearBadgeProps {
  year: number;
  backgroundImage?: SanityProjectedImage | null;
}

export default function DistributionYearBadge({
  year,
  backgroundImage,
}: DistributionYearBadgeProps) {
  return (
    <div className={styles.distributionYearBadge}>
      {backgroundImage && (
        <div className={styles.backgroundImage}>
          <AppImage
            image={backgroundImage}
            alt=""
            fill
            sizes="100vw"
            className={styles.image}
          />
        </div>
      )}
      <div className={styles.overlay} />
      <div className={styles.content}>
        <p className={styles.text}>
          Jesteśmy oficjalnym dystrybutorem tej marki od {year} roku.
        </p>
      </div>
    </div>
  );
}
