import PortableText from '@/components/shared/PortableText';
import type { BlockOf } from '@/global/types';

import styles from './styles.module.scss';

export type HeroProps = BlockOf<'hero'>;

export function Hero(props: HeroProps) {
  const first = props.slides?.[0];

  console.log(first);

  return (
    <section className={styles.hero}>
      {first?.title ? (
        <PortableText
          value={first.title}
          className={styles.title}
          headingLevel="h1"
        />
      ) : null}
      {first?.description ? (
        <PortableText
          value={first.description}
          className={styles.description}
        />
      ) : null}
    </section>
  );
}
