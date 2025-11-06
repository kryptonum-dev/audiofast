import Button from '../../ui/Button';
import styles from './styles.module.scss';

export interface TechnicalDataItem {
  title: string;
  value: string;
}

export interface TechnicalDataProps {
  data?: TechnicalDataItem[];
  customId?: string;
  button?: {
    text: string;
    href: string;
  };
}

export default function TechnicalData({
  data,
  customId,
  button,
}: TechnicalDataProps) {
  if (!data || data.length === 0) return null;

  return (
    <section className={`${styles.technicalData} max-width`} id={customId}>
      <div className={styles.container}>
        <div className={styles.wrapper}>
          <h2 className={styles.heading}>Dane techniczne</h2>

          <div className={styles.table}>
            {data.map((item, index) => (
              <div key={index} className={styles.row}>
                <div className={styles.label}>{item.title}</div>
                <div className={styles.value}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {button && (
          <div className={styles.buttonWrapper}>
            <Button text={button.text} variant="primary" href={button.href} />
          </div>
        )}
      </div>
    </section>
  );
}
