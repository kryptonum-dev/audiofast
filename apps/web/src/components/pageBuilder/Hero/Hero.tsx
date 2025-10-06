import type { PagebuilderType } from '@/src/global/types';

import BrandMarquee from './BrandMarquee';
import HeroCarousel from './HeroCarousel';
import styles from './styles.module.scss';

export type HeroProps = PagebuilderType<'hero'> & { index: number };

export function Hero(props: HeroProps) {
  return (
    <section className={`${styles.hero}`}>
      <HeroCarousel slides={props.slides} index={props.index} />
      <BrandMarquee brands={props.brands} />
    </section>
  );
}
