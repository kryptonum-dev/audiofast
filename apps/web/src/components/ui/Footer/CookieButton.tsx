'use client';

import { useCallback } from 'react';

import styles from './styles.module.scss';

export default function CookieButton() {
  const handleClick = useCallback(() => {
    // Delete the cookie consent cookie
    if (typeof document !== 'undefined') {
      document.cookie =
        'cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
    }

    // Dispatch a custom event to notify the CookieConsent component
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cookie_consent_reset'));
    }

    // Reload the page to show the dialog again
    window.location.reload();
  }, []);

  return (
    <button
      className={styles.cookiesButton}
      onClick={handleClick}
      type="button"
    >
      Zarządzaj plikami cookies
    </button>
  );
}
