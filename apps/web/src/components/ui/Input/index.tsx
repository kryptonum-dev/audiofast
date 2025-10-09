import type { FieldErrors, UseFormRegisterReturn } from 'react-hook-form';

import Error from '../Error';
import styles from './styles.module.scss';

export type InputTypes = {
  label?: string;
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
  const handleExpand = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    // Use requestAnimationFrame to avoid forced reflow
    requestAnimationFrame(() => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight + 2}px`;
    });
  };
  return (
    <label
      className={styles.input}
      aria-invalid={!!errors[register.name]}
      data-mode={mode}
    >
      {label && <span className={styles.label}>{label}</span>}
      {textarea ? (
        <textarea {...register} {...props} onInput={handleExpand} />
      ) : (
        <input {...register} {...props} />
      )}
      <Error
        error={errors[register.name]?.message?.toString()}
        withIcon={textarea}
      />
    </label>
  );
}
