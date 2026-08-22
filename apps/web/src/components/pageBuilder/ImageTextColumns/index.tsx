import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../portableText';
import Image from '../../shared/Image';
import Button from '../../ui/Button';
import styles from './styles.module.scss';

type ImageTextColumnsProps = PagebuilderType<'imageTextColumns'> & {
  index: number;
};

export default function ImageTextColumns({
  image,
  heading,
  content,
  button,
  index,
}: ImageTextColumnsProps) {
  const parentHeading = index === 0 ? 'h1' : 'h2';

  return (
    <section className={`${styles.imageTextColumns} max-width`}>
      <Image
        image={image}
        sizes="(max-width: 37.4375rem) 94vw, (max-width: 56.1875rem) 83vw, 501px"
        priority={index === 0}
        loading={index === 0 ? 'eager' : 'lazy'}
      />
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={parentHeading}
          className={styles.heading}
        />
        <PortableText
          value={content}
          enablePortableTextStyles
          className={styles.content}
          parentHeadingLevel={parentHeading}
        />
        <Button {...button} />
      </header>
    </section>
  );
}
