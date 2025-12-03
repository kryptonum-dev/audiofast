import styles from "./styles.module.scss";

type Props = {
  publicationType: string;
};

export default function PublicationType({ publicationType }: Props) {
  return <span className={styles.publicationType}>{publicationType}</span>;
}
