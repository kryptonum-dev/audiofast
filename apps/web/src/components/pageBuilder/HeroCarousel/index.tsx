import type { PagebuilderType } from '@/src/global/types';

import BrandMarquee from './BrandMarquee';
import HeroCarouselClient from './HeroCarousel';
import styles from './styles.module.scss';

export type HeroCarouselProps = PagebuilderType<'heroCarousel'> & {
  index: number;
};

export default function HeroCarousel(props: HeroCarouselProps) {
  return (
    <section className={`${styles.heroCarousel}`}>
      <HeroCarouselClient slides={props.slides} index={props.index} />
      <BrandMarquee brands={props.brands} />
    </section>
  );
}
