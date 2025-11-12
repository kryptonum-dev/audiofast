'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { slugifyFilterName } from '@/src/global/utils';

import styles from './styles.module.scss';

export type CustomFilter = {
  name: string;
  values: string[];
};

type ActiveFilter = {
  filterName: string;
  value: string;
};

type CustomFiltersBarProps = {
  customFilters: CustomFilter[];
  activeFilters: ActiveFilter[];
  basePath: string;
  currentSearchParams: URLSearchParams;
};

export default function CustomFiltersBar({
  customFilters,
  activeFilters,
  basePath,
  currentSearchParams,
}: CustomFiltersBarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const allDropdowns = Array.from(dropdownRefs.current.values());
      const clickedInside = allDropdowns.some((dropdown) =>
        dropdown.contains(event.target as Node)
      );

      if (!clickedInside) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown]);

  if (!customFilters || customFilters.length === 0) {
    return null;
  }

  const handleFilterSelect = (filterName: string, value: string) => {
    const params = new URLSearchParams(currentSearchParams);
    const slugifiedName = slugifyFilterName(filterName);
    const currentValue = params.get(slugifiedName);

    if (currentValue === value) {
      // Click on active value = deselect it
      params.delete(slugifiedName);
    } else {
      // Set new value
      params.set(slugifiedName, value);
    }

    params.delete('page');

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    setOpenDropdown(null);
    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  const handleClearFilter = (filterName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening dropdown
    const params = new URLSearchParams(currentSearchParams);
    const slugifiedName = slugifyFilterName(filterName);
    params.delete(slugifiedName);
    params.delete('page');

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    setOpenDropdown(null);
    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  const handleClearAll = () => {
    const params = new URLSearchParams(currentSearchParams);

    customFilters.forEach((filter) => {
      const slugifiedName = slugifyFilterName(filter.name);
      params.delete(slugifiedName);
    });
    params.delete('page');

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    setOpenDropdown(null);
    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  const getActiveValue = (filterName: string): string | null => {
    return (
      activeFilters.find((f) => f.filterName === filterName)?.value || null
    );
  };

  const hasAnyActiveFilters = activeFilters.length > 0;

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Filtry</h3>
      {customFilters.map((filter) => {
        const activeValue = getActiveValue(filter.name);
        const isOpen = openDropdown === filter.name;

        return (
          <div
            key={filter.name}
            className={styles.dropdown}
            ref={(el) => {
              if (el) dropdownRefs.current.set(filter.name, el);
            }}
          >
            <button
              type="button"
              className={`${styles.trigger} ${activeValue ? styles.active : ''}`}
              onClick={() => setOpenDropdown(isOpen ? null : filter.name)}
              aria-expanded={isOpen}
            >
              <span className={styles.filterName}>{filter.name}</span>
              {activeValue && (
                <span
                  className={styles.activeValue}
                  onClick={(e) => handleClearFilter(filter.name, e)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleClearFilter(
                        filter.name,
                        e as unknown as React.MouseEvent<HTMLButtonElement>
                      );
                    }
                  }}
                  aria-label={`Usuń filtr: ${activeValue}`}
                >
                  {activeValue}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    className={styles.closeIcon}
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18 6L6 18M6 6l12 12"
                    />
                  </svg>
                </span>
              )}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                className={styles.chevron}
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                }}
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 9l6 6 6-6"
                />
              </svg>
            </button>

            {isOpen && (
              <div className={styles.menu}>
                {filter.values.map((value) => {
                  const isActive = activeValue === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.item} ${isActive ? styles.selected : ''}`}
                      onClick={() => handleFilterSelect(filter.name, value)}
                    >
                      <span>{value}</span>
                      {isActive && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          className={styles.check}
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {hasAnyActiveFilters && (
        <button
          type="button"
          className={styles.clearAll}
          onClick={handleClearAll}
        >
          Wyczyść wszystkie
        </button>
      )}
    </div>
  );
}
