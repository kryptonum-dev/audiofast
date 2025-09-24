import type { FieldErrors, UseFormRegisterReturn } from 'react-hook-form';

import Error from '../Error';
import styles from './styles.module.scss';

export type InputTypes = {
  label: string;
  mode?: 'light' | 'dark';
  register: UseFormRegisterReturn;
  errors: FieldErrors;
  textarea?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function Input({
  label,
  mode = 'light',
  register,
  errors,
  textarea = false,
  ...props
}: InputTypes) {
  const Element = textarea ? 'textarea' : 'input';

  return (
    <label
      className={styles.input}
      aria-invalid={!!errors[register.name]}
      data-mode={mode}
    >
      <span className={styles.label}>{label}</span>
      <Element {...register} {...props} />
      <Error error={errors[register.name]?.message?.toString()} />
    </label>
  );
}
