'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useCart } from '@/src/global/b2c/cart/use-cart';

import styles from './styles.module.scss';

type UtilityLink = {
  id: 'contact' | 'account' | 'cart';
  href: string;
  label: string;
};

export default function HeaderUtilityLinks() {
  const pathname = usePathname();
  const { totals, isHydrated } = useCart();
  const isCartMode = pathname?.startsWith('/koszyk') ?? false;
  const utilityLinks: UtilityLink[] = [
    {
      id: 'contact',
      href: '/kontakt',
      label: 'Kontakt',
    },
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
    <>
      {utilityLinks.map((link) => {
        const isActive =
          link.href === '/'
            ? pathname === '/'
            : pathname?.startsWith(link.href) && link.href !== '';
        const hasCartCount =
          link.id === 'cart' && isHydrated && totals.itemCount > 0;

        return (
          <Link
            key={link.id}
            href={link.href}
            className={`${styles.navLink} ${styles.utilityLink} ${
              link.id === 'contact' ? styles.contactUtilityLink : ''
            } ${link.id === 'cart' ? styles.cartUtilityLink : ''} ${
              link.id === 'contact' && isCartMode ? styles.contactUtilityLinkHidden : ''
            } ${isActive ? styles.active : ''}`}
            aria-current={isActive ? 'page' : undefined}
            aria-hidden={link.id === 'contact' && isCartMode}
            tabIndex={link.id === 'contact' && isCartMode ? -1 : undefined}
          >
            <span className={styles.utilityIcon} aria-hidden="true">
              {getUtilityIcon(link.id)}
            </span>
            <span
              className={`${styles.utilityLabel} ${link.id === 'cart' ? styles.cartUtilityLabel : ''}`}
            >
              {link.label}
            </span>
            {hasCartCount ? (
              <span className={styles.countBadge}>{totals.itemCount}</span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}

function getUtilityIcon(id: UtilityLink['id']) {
  switch (id) {
    case 'contact':
      return <ContactIcon />;
    case 'account':
      return <AccountIcon />;
    case 'cart':
      return <CartIcon />;
    default:
      return null;
  }
}

const ContactIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m3 20 1.3-3.9c-1.124-1.662-1.53-3.63-1.144-5.538S4.696 6.935 6.4 5.726s3.845-1.828 6.024-1.74c2.179.09 4.248.878 5.821 2.22 1.574 1.342 2.546 3.147 2.735 5.079s-.417 3.858-1.706 5.422c-1.29 1.564-3.173 2.658-5.302 3.08-2.13.422-4.358.142-6.272-.787z"
    />
  </svg>
);

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
