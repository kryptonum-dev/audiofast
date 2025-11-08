import type { QueryProductBySlugResult } from '@/src/global/sanity/sanity.types';

import PortableText from '../../portableText';
import styles from './styles.module.scss';

interface TechnicalDataProps {
  data?: NonNullable<NonNullable<QueryProductBySlugResult>['technicalData']>;
  customId?: string;
}

export default function TechnicalData({ data, customId }: TechnicalDataProps) {
  if (!data || data.length === 0) return null;

  return (
    <section
      className={`${styles.technicalData} max-width-block`}
      id={customId}
    >
      <h2 className={styles.heading}>Dane techniczne</h2>
      <table className={styles.table}>
        <tbody>
          {data.map((item, index) => (
            <tr key={index} className={styles.row}>
              <td className={styles.cell}>{item.title}</td>
              <td className={styles.cell}>
                <PortableText value={item.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
