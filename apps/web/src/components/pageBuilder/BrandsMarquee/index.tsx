import { getImageProps } from 'next/image';

import { urlFor } from '@/global/sanity/client';
import type { PagebuilderType } from '@/src/global/types';

import BrandSelector from './BrandSelector';
import styles from './styles.module.scss';

type BrandsMarqueeProps = PagebuilderType<'brandsMarquee'> & {
  index: number;
};

export default function BrandsMarquee(props: BrandsMarqueeProps) {
  const { backgroundImage, index } = props;

  // Calculate heading level offset: 0 for first section, 1 for others
  const headingLevelOffset = index === 0 ? 0 : 1;

  // Build optimized image URLs for different aspect ratios
  const backgroundArt = backgroundImage?.id
    ? (() => {
        // Convert to Sanity image source format
        const sanitySource = {
          asset: { _ref: backgroundImage.id },
          ...(backgroundImage.hotspot && {
            hotspot: backgroundImage.hotspot,
          }),
          ...(backgroundImage.crop && {
            crop: backgroundImage.crop,
          }),
        };

        // Desktop: 21:9 aspect ratio (e.g., 1920x823)
        const desktopSrc = urlFor(sanitySource)
          .width(2120)
          .height(823)
          .fit('crop')
          .auto('format')
          .url();

        // Mobile: 3:4 aspect ratio (e.g., 600x800)
        const mobileSrc = urlFor(sanitySource)
          .width(600)
          .height(800)
          .fit('crop')
          .auto('format')
          .url();

        const mobile = getImageProps({
          alt: '',
          src: mobileSrc,
          width: 600,
          height: 800,
          sizes: '(min-width: 85.375rem) 1366px, 100vw',
        }).props;

        const desktop = getImageProps({
          alt: '',
          src: desktopSrc,
          width: 1302,
          height: 556,
          sizes: '(min-width: 85.375rem) 1366px, 100vw',
        }).props;

        return { mobile, desktop };
      })()
    : undefined;

  return (
    <section className={`${styles.brandsMarquee} max-width-block`}>
      <picture>
        <source
          media="(min-width: 42.5rem)"
          srcSet={backgroundArt!.desktop.srcSet}
          sizes={backgroundArt!.desktop.sizes}
        />
        {
          // eslint-disable-next-line @next/next/no-img-element
          <img
            {...backgroundArt!.mobile}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        }
      </picture>
      <BrandSelector {...props} headingLevelOffset={headingLevelOffset} />
    </section>
  );
}
