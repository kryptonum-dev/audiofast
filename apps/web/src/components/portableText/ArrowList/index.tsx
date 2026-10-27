import type { PortableTextTypeComponentProps } from '@portabletext/react';

import {
  dataSanity,
  type ScopedDataAttribute,
} from '@/src/global/sanity/data-attribute';
import type { PortableTextProps } from '@/src/global/types';

import PortableText from '../index';
import styles from './styles.module.scss';

type ArrowListValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptArrowList';
};

export function ArrowListComponent({
  value,
  dataAttribute,
}: PortableTextTypeComponentProps<ArrowListValue> & {
  /** Draft only: scoped to this block (`<field>[_key==…]`); `items[]` is draggable. */
  dataAttribute?: ScopedDataAttribute;
}) {
  const { items } = value;
  return (
    <ul className={styles.list}>
      {items!.map((item) => (
        <li
          key={item._key}
          className={styles.item}
          data-sanity={dataSanity(dataAttribute, [
            'items',
            { _key: item._key },
          ])}
        >
          <PortableText value={item.content} />
        </li>
      ))}
    </ul>
  );
}
