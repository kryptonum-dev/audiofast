import type { BlockOf } from '@/global/types';

import HeroCarousel from './HeroCarousel';
import styles from './styles.module.scss';

export type HeroProps = BlockOf<'hero'>;

export function Hero(props: HeroProps) {
  return (
    <section className={`${styles.hero}`}>
      <HeroCarousel slides={props.slides} />
      {/* <BrandMarquee brands={props.brands} /> */}
    </section>
  );
}
