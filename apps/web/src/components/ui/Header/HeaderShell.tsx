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
  buttons: NonNullable<QueryNavbarResult>['buttons'];
};

export default function HeaderShell({ buttons }: HeaderShellProps) {
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
              <div className={styles.primaryLinks} aria-hidden={isCartMode}>
                <HeaderLinks buttons={buttons || []} />
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
