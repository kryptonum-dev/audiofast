'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useCart } from '@/src/global/b2c/cart/use-cart';

import styles from './styles.module.scss';

type QuickAction = {
  id: 'account' | 'cart';
  href: string;
  label: string;
};

export default function HeaderQuickActions() {
  const pathname = usePathname();
  const { totals, isHydrated } = useCart();
  const quickActions: QuickAction[] = [
    {
      id: 'account',
      href: '/konto-klienta',
      label: 'Konto klienta',
    },
    {
      id: 'cart',
      href: '/koszyk',
      label: 'Koszyk',
    },
  ];

  return (
    <div className={styles.quickActions} aria-label="Szybkie akcje">
      {quickActions.map((action) => {
        const isActive =
          action.href === '/'
            ? pathname === '/'
            : pathname?.startsWith(action.href) && action.href !== '';
        const hasCartCount =
          action.id === 'cart' && isHydrated && totals.itemCount > 0;

        return (
          <Link
            key={action.id}
            href={action.href}
            className={`${styles.quickActionLink} ${isActive ? styles.active : ''} ${
              action.id === 'cart' ? styles.quickActionCart : ''
            }`}
            aria-current={isActive ? 'page' : undefined}
            aria-label={action.label}
          >
            <span className={styles.quickActionIcon} aria-hidden="true">
              {action.id === 'account' ? <AccountIcon /> : <CartIcon />}
            </span>
            {hasCartCount ? (
              <span className={styles.countBadge}>{totals.itemCount}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

const AccountIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
    >
      <path d="M3 12a9 9 0 1 0 18.001 0A9 9 0 0 0 3 12" />
      <path d="M9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0M6.172 18.849A4 4 0 0 1 10.004 16h4a4 4 0 0 1 3.834 2.855" />
    </g>
  </svg>
);

const CartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
    >
      <path d="M6.328 8h11.34a2 2 0 0 1 1.976 2.304l-1.255 8.152A3 3 0 0 1 15.423 21H8.571a3 3 0 0 1-2.965-2.544l-1.255-8.152A2 2 0 0 1 6.328 8" />
      <path d="M9 11V6a3 3 0 1 1 6 0v5" />
    </g>
  </svg>
);
