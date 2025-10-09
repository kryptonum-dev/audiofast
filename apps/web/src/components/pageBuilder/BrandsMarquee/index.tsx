import { getImageProps } from 'next/image';

import { type SanityRawImage } from '@/components/shared/Image';
import { urlFor } from '@/global/sanity/client';
import type { PagebuilderType } from '@/src/global/types';

import BrandSelector from './BrandSelector';
import styles from './styles.module.scss';

type BrandsMarqueeProps = PagebuilderType<'brandsMarquee'> & {
  index: number;
};

function getBackgroundArt(
  backgroundImage: SanityRawImage | undefined,
  mobileImage: SanityRawImage | undefined
) {
  const desktopImg = backgroundImage;
  const mobileImg = mobileImage;

  const desktopSrc = desktopImg?.id
    ? urlFor({ asset: { _ref: desktopImg.id } })
        .fit('crop')
        .auto('format')
        .url()
    : undefined;

  const mobileSrc = mobileImg?.id
    ? urlFor({ asset: { _ref: mobileImg.id } })
        .fit('crop')
        .auto('format')
        .url()
    : undefined;

  const mobileUrl = mobileSrc ?? desktopSrc;
  if (!mobileUrl && !desktopSrc) return undefined;

  const mobile = getImageProps({
    alt: '',
    src: mobileUrl!,
    width: mobileSrc ? 1200 : 1920,
    height: mobileSrc ? 1600 : 1080,
    sizes: '100vw',
  }).props;

  const desktop = desktopSrc
    ? getImageProps({
        alt: '',
        src: desktopSrc,
        width: 1920,
        height: 1080,
        sizes: '100vw',
      }).props
    : undefined;

  return { mobile, desktop };
}

export default function BrandsMarquee(props: BrandsMarqueeProps) {
  const { backgroundImage, mobileImage, index } = props;

  // Calculate heading level offset: 0 for first section, 1 for others
  const headingLevelOffset = index === 0 ? 0 : 1;

  // Build optimized image URLs for desktop and mobile
  const backgroundArt = getBackgroundArt(
    backgroundImage as SanityRawImage | undefined,
    mobileImage as SanityRawImage | undefined
  );

  return (
    <section className={`${styles.brandsMarquee} max-width-block`}>
      <picture>
        <source
          media="(min-width: 62.5rem)"
          srcSet={backgroundArt!.desktop!.srcSet!}
          sizes={backgroundArt!.desktop!.sizes!}
        />
        <img
          {...backgroundArt!.mobile}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </picture>
      <BrandSelector {...props} headingLevelOffset={headingLevelOffset} />
    </section>
  );
}
