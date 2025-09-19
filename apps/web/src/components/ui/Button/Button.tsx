import { useMemo } from 'react';

import styles from './Button.module.scss';

export type Props = React.HTMLAttributes<HTMLAnchorElement> &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    text?: string | React.ReactNode;
    children?: React.ReactNode;
    variant?: 'primary' | 'secondary';
    openInNewTab?: boolean;
    className?: string;
    href?: string;
    iconUsed?: 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight';
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
  const Element = href ? 'a' : 'button';
  const renderedProps = {
    ...(href && { href }),
    ...(openInNewTab && { target: '_blank', rel: 'noreferrer' }),
    'data-variant': variant,
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
      default:
        return null;
    }
  }, [iconUsed]);

  return (
    <Element {...renderedProps}>
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
