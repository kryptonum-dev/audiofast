import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../shared/PortableText';
import Steps from './Steps';
import styles from './styles.module.scss';

type StepListProps = PagebuilderType<'stepList'> & { index: number };

export default function StepList({
  heading,
  paragraph,
  steps,
  index,
}: StepListProps) {
  return (
    <section className={`${styles.stepList} max-width`}>
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
          className={styles.heading}
        />
        <PortableText
          value={paragraph}
          enablePortableTextStyles
          className={styles.paragraph}
        />
      </header>
      <Steps steps={steps} />
    </section>
  );
}
