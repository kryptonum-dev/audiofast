import type { HTMLAttributes, InputHTMLAttributes } from 'react';

import styles from './styles.module.scss';

type SwitchProps = {
  id?: string;
  asLabel?: boolean;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
} & Omit<HTMLAttributes<HTMLLabelElement>, 'onChange'>;

export default function Switch({
  id,
  asLabel = true,
  inputProps,
  ...props
}: SwitchProps) {
  const Element = asLabel ? 'label' : 'div';
  return (
    <Element
      className={styles.switch}
      {...(asLabel && id ? { htmlFor: id } : {})}
      {...(props as HTMLAttributes<HTMLLabelElement | HTMLDivElement>)}
    >
      <input
        type="checkbox"
        className={styles.checkbox}
        id={id}
        {...inputProps}
      />
      <div className={styles.dot} />
    </Element>
  );
}
