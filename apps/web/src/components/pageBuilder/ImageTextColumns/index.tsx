import Image from '../../shared/Image';
import type { PageBuilderBlock } from '../../shared/PageBuilder';
import PortableText from '../../shared/PortableText';
import Button from '../../ui/Button';
import styles from './styles.module.scss';

type ImageTextColumnsProps = Extract<
  PageBuilderBlock,
  { _type: 'imageTextColumns' }
>;

export default function ImageTextColumns({
  image,
  heading,
  content,
  button,
}: ImageTextColumnsProps) {
  return (
    <section className={`${styles.imageTextColumns} max-width`}>
      <Image
        image={image}
        sizes="(max-width: 37.4375rem) 94vw, (max-width: 56.1875rem) 83vw, 501px"
      />
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel="h2"
          className={styles.heading}
        />
        <PortableText
          value={content}
          enablePortableTextStyles
          className={styles.content}
        />
        <Button {...button} />
      </header>
    </section>
  );
}
