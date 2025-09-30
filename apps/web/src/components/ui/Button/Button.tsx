import Link from 'next/link';
import { useMemo } from 'react';

import styles from './Button.module.scss';

export type Props = React.HTMLAttributes<HTMLAnchorElement> &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    text?: string | React.ReactNode;
    children?: React.ReactNode;
    variant?: 'primary' | 'secondary' | null;
    openInNewTab?: boolean | null;
    className?: string;
    href?: string | null;
    iconUsed?: 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight' | 'refresh';
  };

export default function Button({
  children,
  text,
  variant = 'primary',
  openInNewTab = false,
  className,
  href,
  iconUsed = 'arrowUp',
  ...props
}: Props) {
  const Element = href ? Link : 'button';
  const renderedProps = {
    ...(href && { href }),
    ...(openInNewTab && { target: '_blank', rel: 'noreferrer' }),
    'data-variant': variant,
    'data-icon': iconUsed,
    className: `${styles.Button}${className ? ` ${className}` : ''}`,
    ...props,
  };

  const icon = useMemo(() => {
    switch (iconUsed) {
      case 'arrowUp':
        return <ArrowUp />;
      case 'arrowDown':
        return <ArrowUp />;
      case 'arrowLeft':
        return <ArrowUp />;
      case 'arrowRight':
        return <ArrowUp />;
      case 'refresh':
        return <RefreshIcon />;
      default:
        return <ArrowUp />;
    }
  }, [iconUsed]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Element {...(renderedProps as any)}>
      <div className={styles.iconContainer}>
        {icon}
        {icon}
      </div>
      <div className={styles.textContainer}>
        <span>{text || children}</span>
      </div>
    </Element>
  );
}

const ArrowUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#a)"
    >
      <path d="M17 7 7 17M8 7h9v9" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" fill="none">
    <g
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      clipPath="url(#refresh-clip)"
    >
      <path d="M7.5 10.5h-4v4" />
      <path d="M21.5 12.5c-.887-1.285-2.48-2.033-4-2-1.52-.033-3.113.715-4 2-.887 1.284-2.48 2.033-4 2-1.52.033-3-1-4-2l-2-2" />
    </g>
    <defs>
      <clipPath id="refresh-clip">
        <path fill="#fff" d="M.5.5h24v24H.5z" />
      </clipPath>
    </defs>
  </svg>
);
