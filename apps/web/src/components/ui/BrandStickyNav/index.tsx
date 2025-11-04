'use client';

import { useEffect, useState } from 'react';

import styles from './styles.module.scss';

export interface BrandStickyNavProps {
  sections: {
    id: string;
    label: string;
    visible: boolean;
  }[];
}

export default function BrandStickyNav({ sections }: BrandStickyNavProps) {
  const [activeSection, setActiveSection] = useState<string>('');
  const [isScrolled, setIsScrolled] = useState(false);

  // Filter visible sections
  const visibleSections = sections.filter((section) => section.visible);

  // Track scroll position for shadow effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer to track active section
  useEffect(() => {
    if (visibleSections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-100px 0px -80% 0px',
      }
    );

    visibleSections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    });

    // Set first section as active initially
    if (visibleSections.length > 0 && visibleSections[0]) {
      setActiveSection(visibleSections[0].id);
    }

    return () => observer.disconnect();
  }, [visibleSections]);

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <nav
      className={`${styles.brandStickyNav} ${isScrolled ? styles.scrolled : ''}`}
      aria-label="Nawigacja sekcji marki"
    >
      <div className={styles.container}>
        <div className={styles.pillsWrapper}>
          {visibleSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`${styles.pill} ${
                activeSection === section.id ? styles.active : ''
              }`}
              aria-current={activeSection === section.id ? 'page' : undefined}
            >
              {section.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
