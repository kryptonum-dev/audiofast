import type { PortableTextTypeComponentProps } from '@portabletext/react';

import type { PortableTextProps } from '@/src/global/types';

import PortableText from '../index';
import styles from './styles.module.scss';

type ArrowListValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptArrowList';
};

export function ArrowListComponent({
  value,
}: PortableTextTypeComponentProps<ArrowListValue>) {
  const { items } = value;
  return (
    <ul className={styles.list}>
      {items!.map((item) => (
        <li key={item._key} className={styles.item}>
          <PortableText value={item.content} />
        </li>
      ))}
    </ul>
  );
}
