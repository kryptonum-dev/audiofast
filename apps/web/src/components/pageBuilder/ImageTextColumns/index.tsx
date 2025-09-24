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
      <Image image={image} sizes="502px" />
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
