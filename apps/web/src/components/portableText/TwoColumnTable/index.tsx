import type { PortableTextTypeComponentProps } from '@portabletext/react';

import { PortableTextRenderer } from '@/src/components/portableText';
import {
  dataSanity,
  type ScopedDataAttribute,
} from '@/src/global/sanity/data-attribute';
import type { PortableTextProps } from '@/src/global/types';

import styles from './styles.module.scss';

type TwoColumnTableValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptTwoColumnTable';
};

export function TwoColumnTableComponent({
  value,
  dataAttribute,
}: PortableTextTypeComponentProps<TwoColumnTableValue> & {
  /** Draft only: scoped to this block (`<field>[_key==…]`); `rows[]` is draggable. */
  dataAttribute?: ScopedDataAttribute;
}) {
  const { rows } = value;

  return (
    <table className={styles.table}>
      <tbody>
        {rows?.map((row) => (
          <tr
            key={row._key}
            className={styles.row}
            data-sanity={dataSanity(dataAttribute, [
              'rows',
              { _key: row._key },
            ])}
          >
            <td className={styles.cell}>{row.column1}</td>
            <td className={styles.cell}>
              <PortableTextRenderer value={row.column2} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
