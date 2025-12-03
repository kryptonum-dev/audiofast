import type { PortableTextTypeComponentProps } from "@portabletext/react";

import type { PortableTextProps } from "@/src/global/types";

import ButtonComponent from "../../ui/Button";
import styles from "./styles.module.scss";

type ButtonValue = NonNullable<PortableTextProps>[number] & {
  _type: "ptButton";
};

export function ButtonPortableTextComponent({
  value,
}: PortableTextTypeComponentProps<ButtonValue>) {
  const { button } = value;
  return <ButtonComponent {...button} className={styles.ptButton} />;
}
