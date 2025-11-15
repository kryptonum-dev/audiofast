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
    iconUsed?:
      | 'arrowUp'
      | 'arrowDown'
      | 'arrowLeft'
      | 'arrowRight'
      | 'refresh'
      | 'submit'
      | 'phone'
      | 'clearFilters'
      | 'applyFilters'
      | 'information'
      | 'trash';
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
      case 'submit':
        return <SubmitIcon />;
      case 'phone':
        return <PhoneIcon />;
      case 'clearFilters':
        return <ClearFiltersIcon />;
      case 'applyFilters':
        return <ApplyFiltersIcon />;
      case 'information':
        return <InformationIcon />;
      case 'trash':
        return <TrashIcon />;
      default:
        return <ArrowUp />;
    }
  }, [iconUsed]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Element {...(renderedProps as any)}>
      <div className={styles.iconContainer}>
        {icon}
        {iconUsed !== 'phone' &&
          iconUsed !== 'clearFilters' &&
          iconUsed !== 'applyFilters' &&
          iconUsed !== 'information' &&
          iconUsed !== 'trash' &&
          icon}
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

const SubmitIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#a)"
    >
      <path d="M10 14 21 3M21 3l-6.5 18a.551.551 0 0 1-1 0L10 14l-7-3.5a.55.55 0 0 1 0-1L21 3Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 22" fill="none">
    <g
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#a)"
    >
      <path d="M5 4.555h4l2 5-2.5 1.5a11 11 0 0 0 5 5l1.5-2.5 5 2v4a2 2 0 0 1-2 2 16 16 0 0 1-15-15 2 2 0 0 1 2-2ZM15 7.555a2 2 0 0 1 2 2M15 3.555a6 6 0 0 1 6 6" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 .555h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);

const ClearFiltersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#clear-filters-clip)"
    >
      <path d="m3 3 18 18M8.997 5h9.5a1 1 0 0 1 .5 1.5l-4.049 4.454M13.998 14v5l-4-3v-4l-5-5.5a1 1 0 0 1 .18-1.316" />
    </g>
    <defs>
      <clipPath id="clear-filters-clip">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);

const ApplyFiltersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#apply-filters-clip)"
    >
      <path d="m12 20-3 1v-8.5L4.52 7.572A2 2 0 0 1 4 6.227V4h16v2.172a2 2 0 0 1-.586 1.414L15 12v3M16 19h6M19 16v6" />
    </g>
    <defs>
      <clipPath id="apply-filters-clip">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);

const InformationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#information-clip)"
    >
      <path d="M3 12a9 9 0 1 0 18.001 0A9 9 0 0 0 3 12ZM12 9h.01" />
      <path d="M11 12h1v4h1" />
    </g>
    <defs>
      <clipPath id="information-clip">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#trash-clip)"
    >
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </g>
    <defs>
      <clipPath id="trash-clip">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
