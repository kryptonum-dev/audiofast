'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps, CSSProperties, ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { logoutCustomerAuthAction } from '@/src/app/actions/customer-auth-logout';

import styles from './CustomerPanelNav.module.scss';

type CustomerPanelNavSection = 'orders' | 'account';

type CustomerPanelNavItem = {
  section: CustomerPanelNavSection;
  label: string;
  href: string;
  Icon: (props: ComponentProps<'svg'>) => ReactElement;
};

type CustomerPanelNavProps = {
  customerDisplayName: string;
};

type NavLinksStyle = CSSProperties & {
  '--active-nav-index': number;
};

const CUSTOMER_PANEL_NAV_ITEMS: CustomerPanelNavItem[] = [
  {
    section: 'orders',
    label: 'Zamówienia',
    href: '/konto-klienta/zamowienia/',
    Icon: OrdersIcon,
  },
  {
    section: 'account',
    label: 'Dane konta',
    href: '/konto-klienta/dane-konta/',
    Icon: AccountIcon,
  },
];

function resolveActiveSection(
  pathname: string | null,
): CustomerPanelNavSection {
  if (pathname?.startsWith('/konto-klienta/dane-konta')) {
    return 'account';
  }

  return 'orders';
}

export default function CustomerPanelNav({
  customerDisplayName,
}: CustomerPanelNavProps) {
  const pathname = usePathname();
  const resolvedActiveSection = resolveActiveSection(pathname);
  const [optimisticSection, setOptimisticSection] =
    useState<CustomerPanelNavSection | null>(null);
  const activeSection = optimisticSection ?? resolvedActiveSection;
  const activeIndex = Math.max(
    CUSTOMER_PANEL_NAV_ITEMS.findIndex(
      (item) => item.section === activeSection,
    ),
    0,
  );

  useEffect(() => {
    setOptimisticSection(null);
  }, [pathname]);

  return (
    <aside className={styles.panelSidebar} aria-label="Panel klienta">
      <span className={styles.panelTitle}>Panel klienta</span>
      <nav className={styles.panelNav} aria-label="Nawigacja panelu klienta">
        <div
          className={styles.navLinks}
          style={{ '--active-nav-index': activeIndex } as NavLinksStyle}
        >
          {CUSTOMER_PANEL_NAV_ITEMS.map((item) => {
            const Icon = item.Icon;

            return (
              <Link
                key={item.section}
                href={item.href}
                className={styles.navLink}
                aria-current={
                  item.section === activeSection ? 'page' : undefined
                }
                onClick={() => setOptimisticSection(item.section)}
              >
                <Icon className={styles.navIcon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className={styles.sessionBlock}>
        <span className={styles.sessionLabel}>Zalogowano jako</span>
        <strong className={styles.sessionName}>{customerDisplayName}</strong>
        <form action={logoutCustomerAuthAction} className={styles.logoutForm}>
          <LogoutSubmitButton />
        </form>
      </div>
    </aside>
  );
}

function LogoutSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={styles.logoutButton}
      disabled={pending}
      aria-busy={pending || undefined}
      data-pending={pending ? 'true' : 'false'}
    >
      {pending ? (
        <span className={styles.logoutSpinner} aria-hidden="true" />
      ) : (
        <LogoutIcon />
      )}
      <span>{pending ? 'Wylogowywanie...' : 'Wyloguj się'}</span>
    </button>
  );
}

function OrdersIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        clipPath="url(#customer-panel-orders-icon)"
      >
        <path d="M9 6h11M9 12h11M9 18h11M5 6v.01M5 12v.01M5 18v.01" />
      </g>
      <defs>
        <clipPath id="customer-panel-orders-icon">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function AccountIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        clipPath="url(#customer-panel-account-icon)"
      >
        <path d="M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h3.5M18.42 15.61a2.101 2.101 0 0 1 2.97 2.97L18 22h-3v-3z" />
      </g>
      <defs>
        <clipPath id="customer-panel-account-icon">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function LogoutIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        clipPath="url(#customer-panel-logout-icon)"
      >
        <path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2M7 12h14m0 0-3-3m3 3-3 3" />
      </g>
      <defs>
        <clipPath id="customer-panel-logout-icon">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}
