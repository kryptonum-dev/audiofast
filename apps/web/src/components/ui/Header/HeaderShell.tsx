'use client';

import { usePathname } from 'next/navigation';

import type { QueryNavbarResult } from '@/global/sanity/sanity.types';
import LogoLink from '@/src/components/ui/LogoLink';

import HeaderLinks from './HeaderLinks';
import HeaderQuickActions from './HeaderQuickActions';
import HeaderUtilityLinks from './HeaderUtilityLinks';
import MobileNavToggle from './MobileNavToggle';
import styles from './styles.module.scss';

type HeaderShellProps = {
  buttons: NonNullable<NonNullable<QueryNavbarResult>['buttons']>;
  /** Draft-only `data-sanity` for `navbar.buttons` (pre-built on the server). */
  linksDataSanity?: string;
  /** Draft-only `data-sanity` per `navbar.buttons` item `_key` (draggable). */
  linkDataSanity?: Record<string, string | undefined>;
};

export default function HeaderShell({
  buttons,
  linksDataSanity,
  linkDataSanity,
}: HeaderShellProps) {
  const pathname = usePathname();
  const isCartMode = pathname?.startsWith('/koszyk') ?? false;

  return (
    <header
      className={styles.header}
      data-mode={isCartMode ? 'cart' : 'default'}
    >
      <SkipLink />
      <div className={styles.container}>
        <LogoLink />

        <div className={styles.contentArea}>
          <div className={styles.navWrapper}>
            <HeaderQuickActions />
            {!isCartMode ? <MobileNavToggle /> : null}
            <nav
              className={styles.nav}
              id="main-navigation"
              aria-label="Główna nawigacja"
            >
              <div
                className={styles.primaryLinks}
                aria-hidden={isCartMode}
                data-sanity={linksDataSanity}
              >
                <HeaderLinks
                  buttons={buttons}
                  linkDataSanity={linkDataSanity}
                />
              </div>
              <div className={styles.utilityLinks}>
                <HeaderUtilityLinks />
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

function SkipLink() {
  return (
    <a href="#main" className={styles.skipLink}>
      Przejdź do treści głównej
    </a>
  );
}
