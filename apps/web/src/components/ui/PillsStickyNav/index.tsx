'use client';

import { useEffect, useRef, useState } from 'react';

import styles from './styles.module.scss';

export interface PillsStickyNavProps {
  sections: {
    id: string;
    label: string;
    visible: boolean;
  }[];
  className?: string;
}

export default function PillsStickyNav({
  sections,
  className,
}: PillsStickyNavProps) {
  const [activeSection, setActiveSection] = useState<string>('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileVisible, setIsMobileVisible] = useState(true);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [isMobileBreakpoint, setIsMobileBreakpoint] = useState(false);
  const [sliderStyle, setSliderStyle] = useState<{
    width: number;
    height?: number;
    transform: string;
  }>({ width: 0, transform: 'translateX(0)' });
  const navRef = useRef<HTMLElement>(null);
  const pillsWrapperRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const lastScrollY = useRef<number>(0);

  // Track scroll position for shadow effect and mobile visibility
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isMobile = window.innerWidth <= 767;
      setIsMobileBreakpoint(isMobile);

      // Check if nav is actually sticking (when its top position equals sticky top value)
      const rect = nav.getBoundingClientRect();
      const stickyTop = 76; // 4.75rem = 76px
      setIsScrolled(rect.top <= stickyTop && currentScrollY > 0);

      // Mobile scroll direction tracking
      if (isMobile) {
        // Hide when scrolling down, show when scrolling up
        if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
          setIsMobileVisible(false);
          setIsMobileExpanded(false);
        } else if (currentScrollY < lastScrollY.current) {
          setIsMobileVisible(true);
        }
        lastScrollY.current = currentScrollY;
      } else {
        setIsMobileVisible(true);
      }
    };

    // Check initial state
    const initialIsMobile = window.innerWidth <= 767;
    setIsMobileBreakpoint(initialIsMobile);
    handleScroll();
    lastScrollY.current = window.scrollY;

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Update slider position when active section changes
  useEffect(() => {
    if (!activeSection || !pillsWrapperRef.current) return;

    const updateSliderPosition = () => {
      const activePill = pillRefs.current.get(activeSection);
      const wrapper = pillsWrapperRef.current;
      const isMobile = window.innerWidth <= 767;

      if (activePill && wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const pillRect = activePill.getBoundingClientRect();

        if (isMobile) {
          // Column layout: translateY for vertical movement
          const top = pillRect.top - wrapperRect.top;
          const height = pillRect.height;
          setSliderStyle({
            width: pillRect.width,
            height,
            transform: `translateY(${top}px)`,
          });
        } else {
          // Row layout: translateX for horizontal movement
          const left = pillRect.left - wrapperRect.left;
          const width = pillRect.width;
          setSliderStyle({
            width,
            transform: `translateX(${left}px)`,
          });
        }
      }
    };

    // Update after a small delay to ensure DOM is rendered
    const timeoutId = setTimeout(() => {
      updateSliderPosition();
    }, 0);

    // Update on resize
    window.addEventListener('resize', updateSliderPosition, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateSliderPosition);
    };
  }, [activeSection, sections]);

  // Intersection Observer to track active section
  useEffect(() => {
    if (sections.length === 0) return;

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
      },
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    });

    // Set first section as active initially
    if (sections.length > 0 && sections[0]) {
      setActiveSection(sections[0].id);
    }

    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) {
    return null;
  }

  const activeLabel =
    sections.find((s) => s.id === activeSection)?.label || sections[0]?.label;

  return (
    <>
      {isMobileBreakpoint && isMobileExpanded && (
        <div
          className={styles.backdrop}
          onClick={() => setIsMobileExpanded(false)}
          aria-hidden="true"
        />
      )}

      {isMobileBreakpoint && !isMobileExpanded && isMobileVisible && (
        <button
          type="button"
          className={styles.compactIndicator}
          onClick={() => setIsMobileExpanded(true)}
          aria-label="Rozwiń nawigację"
        >
          <span>{activeLabel}</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 5.5L4 9.5L4.7 10.2L8 6.9L11.3 10.2L12 9.5L8 5.5Z" />
          </svg>
        </button>
      )}

      <nav
        ref={navRef}
        className={`${styles.pillsStickyNav} ${className} ${
          !isMobileBreakpoint ? 'max-width-block' : ''
        } ${isScrolled ? styles.scrolled : ''} ${isMobileExpanded ? styles.expanded : ''}`}
        aria-label="Nawigacja sekcji"
      >
        <div ref={pillsWrapperRef} className={styles.pillsWrapper}>
          <div
            className={styles.slider}
            style={{
              width: `${sliderStyle.width}px`,
              height: sliderStyle.height
                ? `${sliderStyle.height}px`
                : undefined,
              transform: sliderStyle.transform,
            }}
          />
          {sections.map((section) => (
            <a
              key={section.id}
              ref={(el) => {
                if (el) {
                  pillRefs.current.set(section.id, el);
                } else {
                  pillRefs.current.delete(section.id);
                }
              }}
              tabIndex={activeSection === section.id ? -1 : 0}
              href={`#${section.id}`}
              className={styles.pill}
              aria-current={activeSection === section.id ? 'page' : undefined}
              onClick={() => {
                if (isMobileBreakpoint) {
                  setIsMobileExpanded(false);
                }
              }}
            >
              {section.label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
