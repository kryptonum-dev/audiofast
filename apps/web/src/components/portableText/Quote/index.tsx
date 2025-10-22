import type { PortableTextTypeComponentProps } from '@portabletext/react';

import type { PortableTextProps } from '@/src/global/types';

import PortableText from '../index';
import styles from './styles.module.scss';

type QuoteValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptQuote';
};

export function QuoteComponent({
  value,
}: PortableTextTypeComponentProps<QuoteValue>) {
  const { quote } = value;
  return (
    <blockquote className={styles.quote}>
      <PortableText value={quote} />
    </blockquote>
  );
}

