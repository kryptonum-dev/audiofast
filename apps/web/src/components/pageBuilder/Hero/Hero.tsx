import type { BlockOf } from '@/global/types';

import BrandMarquee from './BrandMarquee';
import HeroCarousel from './HeroCarousel';
import styles from './styles.module.scss';

export type HeroProps = BlockOf<'hero'> & { index: number };

export function Hero(props: HeroProps) {
  return (
    <section className={`${styles.hero}`}>
      <HeroCarousel slides={props.slides} index={props.index} />
      <BrandMarquee brands={props.brands} />
    </section>
  );
}
