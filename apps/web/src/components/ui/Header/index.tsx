import Link from 'next/link';

import { fetchWithLogging } from '@/global/sanity/client';
import { queryNavbar } from '@/global/sanity/query';
import type { QueryNavbarResult } from '@/global/sanity/sanity.types';
import LogoLink from '@/src/components/ui/LogoLink';

import MobileNavToggle from './MobileNavToggle';
import styles from './styles.module.scss';

export default async function Header() {
  const navbarData = await fetchWithLogging<QueryNavbarResult>({
    label: 'Navbar fetch failed',
    query: queryNavbar,
    tags: ['navbar'],
  });

  return (
    <header className={styles.header}>
      {/* Skip link - first element in tab order for accessibility */}
      <SkipLink />
      <div className={styles.container}>
        <LogoLink />

        <div className={styles.navWrapper}>
          {/* Mobile Menu Toggle Component - first in tab order */}
          <MobileNavToggle />

          {/* Single navigation list used for both desktop and mobile */}
          <nav
            className={styles.nav}
            id="main-navigation"
            aria-label="Główna nawigacja"
          >
            {navbarData?.buttons?.map((button) => (
              <Link
                key={button._key}
                href={button.href!}
                className={styles.navLink}
                {...(button.openInNewTab && {
                  target: '_blank',
                  rel: 'noreferrer',
                })}
              >
                {button.text}
              </Link>
            ))}
          </nav>
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
