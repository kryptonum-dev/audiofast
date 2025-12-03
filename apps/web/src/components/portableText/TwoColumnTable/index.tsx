import type { PortableTextTypeComponentProps } from "@portabletext/react";

import { PortableTextRenderer } from "@/src/components/portableText";
import type { PortableTextProps } from "@/src/global/types";

import styles from "./styles.module.scss";

type TwoColumnTableValue = NonNullable<PortableTextProps>[number] & {
  _type: "ptTwoColumnTable";
};

export function TwoColumnTableComponent({
  value,
}: PortableTextTypeComponentProps<TwoColumnTableValue>) {
  const { rows } = value;

  return (
    <table className={styles.table}>
      <tbody>
        {rows?.map((row) => (
          <tr key={row._key} className={styles.row}>
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
