import Image from '../../shared/Image';
import type { PageBuilderBlock } from '../../shared/PageBuilder';
import PortableText from '../../shared/PortableText';
import Button from '../../ui/Button';
import styles from './styles.module.scss';

type ImageTextColumnsProps = Extract<
  PageBuilderBlock,
  { _type: 'imageTextColumns' }
> & {
  index: number;
};

export default function ImageTextColumns({
  image,
  heading,
  content,
  button,
  index,
}: ImageTextColumnsProps) {
  // Parent heading level for the section
  const parentHeading = index === 0 ? 'h1' : 'h2';

  return (
    <section className={`${styles.imageTextColumns} max-width`}>
      <Image
        image={image}
        sizes="(max-width: 37.4375rem) 94vw, (max-width: 56.1875rem) 83vw, 501px"
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
