import { sanityFetch } from '@/global/sanity/fetch';
import { queryNavbar } from '@/global/sanity/query';
import type { QueryNavbarResult } from '@/global/sanity/sanity.types';
import LogoLink from '@/src/components/ui/LogoLink';

import HeaderLinks from './HeaderLinks';
import HeaderQuickActions from './HeaderQuickActions';
import HeaderUtilityLinks from './HeaderUtilityLinks';
import MobileNavToggle from './MobileNavToggle';
import styles from './styles.module.scss';

export default async function Header() {
  'use cache';
  const navbarData = await sanityFetch<QueryNavbarResult>({
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
          <HeaderQuickActions />
          {/* Mobile Menu Toggle Component - first in tab order */}
          <MobileNavToggle />

          {/* Single navigation list used for both desktop and mobile */}
          <nav
            className={styles.nav}
            id="main-navigation"
            aria-label="Główna nawigacja"
          >
            <div className={styles.primaryLinks}>
              <HeaderLinks buttons={navbarData?.buttons || []} />
            </div>
            <div className={styles.utilityLinks}>
              <HeaderUtilityLinks />
            </div>
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
