import type { PortableTextTypeComponentProps } from '@portabletext/react';

import { PortableTextRenderer } from '@/src/components/portableText';
import type { PortableTextProps } from '@/src/global/types';

import styles from './styles.module.scss';

type TableRow = {
  _key: string;
  column1: string;
  column2: PortableTextProps;
};

type TwoColumnTableValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptTwoColumnTable';
  rows?: TableRow[];
};

export function TwoColumnTableComponent({
  value,
}: PortableTextTypeComponentProps<TwoColumnTableValue>) {
  const { rows } = value;

  if (!rows || rows.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <tbody>
          {rows.map((row: TableRow) => (
            <tr key={row._key} className={styles.row}>
              <td className={styles.cell}>{row.column1}</td>
              <td className={styles.cell}>
                <PortableTextRenderer value={row.column2} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
