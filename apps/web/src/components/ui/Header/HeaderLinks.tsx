'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { QueryNavbarResult } from '@/global/sanity/sanity.types';

import styles from './styles.module.scss';

type HeaderLinksProps = {
  buttons: NonNullable<NonNullable<QueryNavbarResult>['buttons']>;
  /** Draft-only `data-sanity` per button `_key` (pre-built on the server). */
  linkDataSanity?: Record<string, string | undefined>;
};

export default function HeaderLinks({
  buttons,
  linkDataSanity,
}: HeaderLinksProps) {
  const pathname = usePathname();
  const isCartMode = pathname?.startsWith('/koszyk') ?? false;

  return (
    <>
      {buttons.map((button) => {
        const href = button.href || '';
        const isActive =
          href === '/'
            ? pathname === '/'
            : pathname?.startsWith(href) && href !== '';
        return (
          <Link
            key={button._key}
            href={href}
            className={`${styles.navLink} ${isActive ? styles.active : ''}`}
            tabIndex={isCartMode ? -1 : undefined}
            data-sanity={linkDataSanity?.[button._key]}
            {...(button.openInNewTab && {
              target: '_blank',
              rel: 'noreferrer',
            })}
          >
            {button.text}
          </Link>
        );
      })}
    </>
  );
}
