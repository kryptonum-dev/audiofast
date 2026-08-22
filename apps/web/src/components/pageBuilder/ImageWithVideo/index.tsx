import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../portableText';
import Image from '../../shared/Image';
import Button from '../../ui/Button';
import YouTubeModal from '../../ui/YouTubeModal';
import styles from './styles.module.scss';

type ImageWithVideoProps = PagebuilderType<'imageWithVideo'> & {
  index: number;
};

export default function ImageWithVideo({
  image,
  youtubeId,
  heading,
  description,
  button,
  index,
}: ImageWithVideoProps) {
  return (
    <section className={`${styles.imageWithVideo} max-width-block`}>
      <div className={styles.imageContainer}>
        <Image
          sizes="(max-width: 37.4375rem) 100vw, (max-width: 85.3125rem) 96vw, 1302px"
          image={image}
          priority={index === 0}
          loading={index === 0 ? 'eager' : 'lazy'}
        />
        {youtubeId && (
          <YouTubeModal
            youtubeId={youtubeId}
            playButtonSize="large"
            closeButtonLabel="Zamknij wideo"
          />
        )}
      </div>
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
          className={styles.heading}
        />
        <PortableText
          value={description}
          className={styles.description}
          enablePortableTextStyles
        />
        <Button {...button} />
      </header>
    </section>
  );
}
