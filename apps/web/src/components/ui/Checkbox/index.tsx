'use client';

import type { FieldErrors } from 'react-hook-form';

import Error from '../Error';
import styles from './styles.module.scss';

type Props = {
  register: {
    name: string;
  };
  errors: FieldErrors | string;
  label: React.ReactNode;
  mode?: 'light' | 'dark';
  disabled?: boolean;
} & React.LabelHTMLAttributes<HTMLLabelElement>;

export default function Checkbox({
  register,
  errors,
  label,
  mode = 'light',
  disabled = false,
  ...props
}: Props) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = event.target as HTMLInputElement;
      target.checked = !target.checked;
      event.target.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  const errorMessage =
    typeof errors === 'string'
      ? errors
      : (errors[register.name]?.message as string);
  return (
    <label className={styles.checkbox} {...props} data-mode={mode}>
      <div className={styles.checkmark}>
        <input
          type="checkbox"
          disabled={disabled}
          {...register}
          aria-invalid={!!errorMessage}
          onKeyDown={handleKeyDown}
        />
        <div className={styles.icon}>
          <Checkmark />
        </div>
      </div>
      <p>{label}</p>
      <Error withIcon>{errorMessage}</Error>
    </label>
  );
}

const Checkmark = () => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none">
      <g clipPath="url(#a)">
        <path
          stroke="#fff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="m3.336 8 3.333 3.333 6.667-6.667"
        />
      </g>
      <defs>
        <clipPath id="a">
          <path fill="#fff" d="M0 0h16v16H0z" />
        </clipPath>
      </defs>
    </svg>
  );
};
