import type { PortableTextTypeComponentProps } from "@portabletext/react";

import type { PortableTextProps } from "@/src/global/types";

import PortableText from "../index";
import styles from "./styles.module.scss";

type CircleNumberedListValue = NonNullable<PortableTextProps>[number] & {
  _type: "ptCircleNumberedList";
};

export function CircleNumberedListComponent({
  value,
}: PortableTextTypeComponentProps<CircleNumberedListValue>) {
  const { items } = value;
  return (
    <ol className={styles.list}>
      {items!.map((item, index) => (
        <li key={item._key} className={styles.item} data-number={index + 1}>
          <PortableText value={item.content} />
        </li>
      ))}
    </ol>
  );
}
