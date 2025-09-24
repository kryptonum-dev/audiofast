'use client';

import { useCallback, useEffect, useState } from 'react';

import styles from './styles.module.scss';

export default function MobileNavToggle() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  // Initial setup for keyboard navigation on mobile
  useEffect(() => {
    const navLinks = document.querySelectorAll('#main-navigation a');
    const isMobile = window.innerWidth <= 699; // 43.6875rem = ~699px

    // On mobile: initially remove links from tab order (menu starts closed)
    if (isMobile) {
      navLinks.forEach((link) => {
        (link as HTMLElement).tabIndex = -1;
      });
    }
  }, []); // Run once on mount

  // Handle ESC key, body scroll lock, and keyboard navigation
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    // Get navigation links for tabIndex management
    const navLinks = document.querySelectorAll('#main-navigation a');
    const isMobile = window.innerWidth <= 699; // 43.6875rem = ~699px

    if (isMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      // Add class to trigger mobile nav styles
      document.documentElement.classList.add('mobile-nav-open');

      // On mobile: make links focusable when menu is open
      if (isMobile) {
        navLinks.forEach((link) => {
          (link as HTMLElement).tabIndex = 0;
        });
      }
    } else {
      document.body.style.overflow = '';
      document.documentElement.classList.remove('mobile-nav-open');

      // On mobile: remove links from tab order when menu is closed
      if (isMobile) {
        navLinks.forEach((link) => {
          (link as HTMLElement).tabIndex = -1;
        });
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      document.documentElement.classList.remove('mobile-nav-open');

      // Cleanup: restore normal tabbing on component unmount
      if (isMobile) {
        navLinks.forEach((link) => {
          (link as HTMLElement).removeAttribute('tabindex');
        });
      }
    };
  }, [isMenuOpen]);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        type="button"
        className={styles.mobileMenuButton}
        onClick={toggleMenu}
        aria-expanded={isMenuOpen}
        aria-controls="main-navigation"
        aria-label={isMenuOpen ? 'Zamknij menu' : 'Otwórz menu nawigacji'}
      >
        <span className={styles.menuButtonText}>
          <span className={styles.menuText}>Menu</span>
          <span className={styles.closeText}>Zamknij</span>
        </span>
        <span className={styles.menuButtonIcon}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      {/* Mobile backdrop */}
      {isMenuOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
