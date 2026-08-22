'use client';

import styles from './styles.module.scss';

type Props = {
  direction: 'prev' | 'next';
  onClick: () => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'filled' | 'gray';
  disabled?: boolean;
  outline?: 'light' | 'dark';
};

export default function ArrowButton({
  direction,
  onClick,
  ariaLabel,
  disabled,
  variant = 'filled',
  size = 'md',
  outline = 'dark',
}: Props) {
  const isPrev = direction === 'prev';
  return (
    <button
      type="button"
      aria-label={
        ariaLabel || (direction === 'prev' ? 'Poprzedni' : 'Następny')
      }
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      data-direction={direction}
      data-outline={outline}
      className={styles.ArrowButton}
      disabled={disabled}
    >
      {isPrev ? <IconPrev /> : <IconNext />}
    </button>
  );
}

const IconPrev = () => (
  <svg
    aria-hidden
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M19 12H5m6-6-6 6 6 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconNext = () => (
  <svg
    aria-hidden
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M5 12h14m-6-6 6 6-6 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
