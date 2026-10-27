import type { PortableTextTypeComponentProps } from '@portabletext/react';

import {
  dataSanity,
  type ScopedDataAttribute,
} from '@/src/global/sanity/data-attribute';
import type { PortableTextProps } from '@/src/global/types';

import PortableText from '../index';
import styles from './styles.module.scss';

type CircleNumberedListValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptCircleNumberedList';
};

export function CircleNumberedListComponent({
  value,
  dataAttribute,
}: PortableTextTypeComponentProps<CircleNumberedListValue> & {
  /** Draft only: scoped to this block (`<field>[_key==…]`); `items[]` is draggable. */
  dataAttribute?: ScopedDataAttribute;
}) {
  const { items } = value;
  return (
    <ol className={styles.list}>
      {items!.map((item, index) => (
        <li
          key={item._key}
          className={styles.item}
          data-number={index + 1}
          data-sanity={dataSanity(dataAttribute, [
            'items',
            { _key: item._key },
          ])}
        >
          <PortableText value={item.content} />
        </li>
      ))}
    </ol>
  );
}
