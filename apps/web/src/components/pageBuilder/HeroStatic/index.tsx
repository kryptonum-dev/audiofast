import { getImageProps } from 'next/image';

import { urlFor } from '@/global/sanity/client';
import type { PagebuilderType } from '@/src/global/types';
import svgToInlineString from '@/src/global/utils';

import PortableText from '../../shared/PortableText';
import styles from './styles.module.scss';

type HeroStaticProps = PagebuilderType<'heroStatic'> & {
  index: number;
};

export default async function HeroStatic({
  heading,
  description,
  image,
  showBlocks,
  blocksHeading,
  blocks,
  index,
}: HeroStaticProps) {
  // Build optimized image URLs for different aspect ratios (server-side)
  const heroImage = image?.id
    ? (() => {
        // Convert SanityProjectedImage to SanityImageSource format
        const sanitySource = {
          asset: { _ref: image.id },
          ...(image.hotspot && {
            hotspot: image.hotspot,
          }),
          ...(image.crop && {
            crop: image.crop,
          }),
        };

        // Desktop: 21:9 aspect ratio (e.g., 1920x823)
        const desktopSrc = urlFor(sanitySource)
          .width(2120)
          .height(823)
          .fit('crop')
          .auto('format')
          .url();

        // Mobile: 3:4 aspect ratio (e.g., 768x1024)
        const mobileSrc = urlFor(sanitySource)
          .width(600)
          .height(600)
          .fit('crop')
          .auto('format')
          .url();

        const mobile = getImageProps({
          alt: '',
          src: mobileSrc,
          width: 600,
          height: 600,
          sizes: '100vw',
          priority: index === 0,
        }).props;

        const desktop = getImageProps({
          alt: '',
          src: desktopSrc,
          width: 1302,
          height: 556,
          sizes: '100vw',
          priority: index === 0,
        }).props;

        return { mobile, desktop };
      })()
    : undefined;

  const blocksWithSvgs = await Promise.all(
    blocks!.map(async (box) => {
      const svgContent = box.iconUrl
        ? await svgToInlineString(box.iconUrl)
        : null;
      return { ...box, svgContent };
    })
  );

  const Heading = index === 0 ? 'h2' : 'h3';

  return (
    <section className={styles.heroStatic}>
      <header className={styles.header} data-has-blocks={showBlocks}>
        <PortableText
          value={heading}
          className={styles.heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
        />
        <PortableText
          value={description}
          className={styles.description}
          enablePortableTextStyles
        />
        <picture>
          <source
            media="(min-width: 37.5rem)"
            srcSet={heroImage?.desktop.srcSet}
            sizes={heroImage?.desktop.sizes}
          />
          {
            // eslint-disable-next-line @next/next/no-img-element
            <img
              {...heroImage?.mobile}
              alt=""
              fetchPriority="high"
              loading="eager"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          }
        </picture>
      </header>
      {showBlocks && blocks && (
        <div className={styles.blocks}>
          <Heading className={styles.blocksHeading}>{blocksHeading}</Heading>
          <ul className={styles.list}>
            {blocksWithSvgs.map((block) => (
              <li key={block._key} className={styles.block}>
                <div
                  className={styles.icon}
                  dangerouslySetInnerHTML={{ __html: block.svgContent! }}
                />
                <PortableText
                  value={block.heading}
                  headingLevel={index === 0 ? 'h3' : 'h4'}
                  className={styles.heading}
                />
                <PortableText
                  value={block.description}
                  className={styles.description}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
