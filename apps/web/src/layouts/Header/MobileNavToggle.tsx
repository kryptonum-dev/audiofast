'use client';

import { useCallback, useEffect, useState } from 'react';

import styles from './styles.module.scss';

export default function MobileNavToggle() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  // Handle ESC key and body scroll lock
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
      // Add class to trigger mobile nav styles
      document.documentElement.classList.add('mobile-nav-open');
    } else {
      document.body.style.overflow = '';
      document.documentElement.classList.remove('mobile-nav-open');
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      document.documentElement.classList.remove('mobile-nav-open');
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
