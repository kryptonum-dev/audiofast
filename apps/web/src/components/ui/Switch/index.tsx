import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
} from 'react';

import styles from './styles.module.scss';

type BaseSwitchProps = {
  id?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
};

type SwitchAsLabelProps = BaseSwitchProps & {
  asLabel: true;
} & Omit<LabelHTMLAttributes<HTMLLabelElement>, 'onChange' | 'popover'>;

type SwitchAsDivProps = BaseSwitchProps & {
  asLabel?: false;
} & Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'popover'>;

type SwitchProps = SwitchAsLabelProps | SwitchAsDivProps;

export default function Switch({
  id,
  asLabel = true,
  inputProps,
  ...props
}: SwitchProps) {
  if (asLabel) {
    return (
      <label
        className={styles.switch}
        htmlFor={id}
        {...(props as LabelHTMLAttributes<HTMLLabelElement>)}
      >
        <input
          type="checkbox"
          className={styles.checkbox}
          id={id}
          {...(inputProps as InputHTMLAttributes<HTMLInputElement>)}
        />
        <div className={styles.dot} />
      </label>
    );
  }

  return (
    <div
      className={styles.switch}
      {...(props as HTMLAttributes<HTMLDivElement>)}
    >
      <input
        type="checkbox"
        className={styles.checkbox}
        id={id}
        {...(inputProps as InputHTMLAttributes<HTMLInputElement>)}
      />
      <div className={styles.dot} />
    </div>
  );
}
