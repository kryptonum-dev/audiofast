import type { PagebuilderType } from '@/src/global/types';
import svgToInlineString from '@/src/global/utils';

import Image from '../../shared/Image';
import PortableText from '../../portableText';
import Button from '../../ui/Button';
import styles from './styles.module.scss';

type ImageWithTextBoxesProps = PagebuilderType<'imageWithTextBoxes'> & {
  index: number;
};

export default async function ImageWithTextBoxes({
  heading,
  image,
  boxes,
  cta,
  index,
}: ImageWithTextBoxesProps) {
  // Fetch all SVG icons in parallel
  const boxesWithSvgs = await Promise.all(
    boxes!.map(async (box) => {
      const svgContent = box.iconUrl
        ? await svgToInlineString(box.iconUrl)
        : null;
      return { ...box, svgContent };
    })
  );

  return (
    <section className={`${styles.imageWithTextBoxes} max-width`}>
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
        />
      </header>
      <Image
        image={image}
        sizes="(max-width: 37.4375rem) 96vw, (max-width: 48.0625rem) 80vw, (max-width: 56.1875rem) 38rem, 29.5625rem"
        priority={index === 0}
        loading={index === 0 ? 'eager' : 'lazy'}
      />
      <ul className={styles.boxes}>
        {boxesWithSvgs.map((box) => (
          <li key={box._key} className={styles.box}>
            {box.svgContent && (
              <div
                className={styles.icon}
                dangerouslySetInnerHTML={{ __html: box.svgContent }}
              />
            )}
            <PortableText
              value={box.heading}
              headingLevel={index === 0 ? 'h2' : 'h3'}
              className={styles.heading}
            />
            <PortableText
              value={box.description}
              enablePortableTextStyles
              className={styles.description}
            />
          </li>
        ))}
      </ul>
      {cta && cta.showCta && (
        <>
          <PortableText
            value={cta.ctaParagraph}
            enablePortableTextStyles
            className={styles.ctaParagraph}
          />
          <Button {...cta.ctaButton} iconUsed="phone" />
        </>
      )}
    </section>
  );
}
