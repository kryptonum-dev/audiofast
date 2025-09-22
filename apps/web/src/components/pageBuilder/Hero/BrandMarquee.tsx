'use server';

import type { BlockOf } from '@/global/types';
import { imageToInlineSvg } from '@/global/utils';

import styles from './styles.module.scss';

export type BrandMarqueeProps = Pick<BlockOf<'hero'>, 'brands'>;

export default async function BrandMarquee({ brands }: BrandMarqueeProps) {
  console.log(brands);

  // Fetch SVG texts on the server for inline rendering
  const svgTexts = await Promise.all(
    brands?.map((b) =>
      b.logoSvgUrl ? imageToInlineSvg(b.logoSvgUrl) : Promise.resolve(undefined)
    ) || []
  );

  console.log(svgTexts);

  const enriched = brands.map((b, i) => ({ ...b, svg: svgTexts[i] }));
  const items = [...enriched, ...enriched];
  const originalLength = enriched.length;

  return (
    <div className={styles.brands} aria-label="Nasze marki">
      <div className={styles.track}>
        {items.map((brand, idx) => {
          const isDuplicate = idx >= originalLength;
          const key = `${brand?.slug || 'brand'}-${idx}`;
          if (brand.svg) {
            // Modify original markup to set width/preserveAspectRatio while keeping all internals intact

            return (
              <span
                key={key}
                className={styles.brandLogo}
                aria-hidden={isDuplicate}
                dangerouslySetInnerHTML={{ __html: brand.svg }}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
