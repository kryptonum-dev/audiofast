import Link from 'next/link';

import styles from './styles.module.scss';

type PillProps = {
  label: string;
  count?: number;
  isActive?: boolean;
  href?: string;
  onClick?: () => void;
};

export default function Pill({
  label,
  count,
  isActive = false,
  href,
  onClick,
}: PillProps) {
  const content = (
    <>
      {label}
      {count !== undefined && ` (${count})`}
    </>
  );

  const className = `${styles.pill} ${isActive ? styles.active : ''}`;

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
}
