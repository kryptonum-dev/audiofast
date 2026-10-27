import {
  dataSanity,
  type ScopedDataAttribute,
} from '@/src/global/sanity/data-attribute';
import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../portableText';
import Steps from './Steps';
import styles from './styles.module.scss';

type StepListProps = PagebuilderType<'stepList'> & {
  index: number;
  /** Draft only: pre-scoped to this block; `steps[]` items are draggable. */
  dataAttribute?: ScopedDataAttribute;
};

export default function StepList({
  heading,
  paragraph,
  steps,
  index,
  dataAttribute,
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
      <Steps
        steps={steps!}
        // `Steps` is a client island: it gets pre-built strings, not the factory.
        stepDataSanity={
          dataAttribute
            ? Object.fromEntries(
                (steps ?? []).map((step) => [
                  step._key,
                  dataSanity(dataAttribute, ['steps', { _key: step._key }]),
                ]),
              )
            : undefined
        }
      />
    </section>
  );
}
