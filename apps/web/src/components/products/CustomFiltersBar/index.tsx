'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import type {
  ActiveRangeFilter,
  CustomFilterDefinition,
} from '@/src/global/filters/types';
import { slugifyFilterName } from '@/src/global/utils';

import { useProductsLoading } from '../ProductsLoadingContext';
import RangeFilter from '../RangeFilter';
import styles from './styles.module.scss';

export type CustomFilter = {
  name: string;
  values: string[];
};

type ActiveFilter = {
  filterName: string;
  value: string;
};

type RangeFilterBounds = {
  min: number;
  max: number;
  productCount: number;
};

type CustomFiltersBarProps = {
  /** Filter definitions from the category (dropdown or range) */
  filterDefinitions: CustomFilterDefinition[];
  /** Available dropdown filter options (computed from products) */
  customFilters: CustomFilter[];
  /** Currently active dropdown filters */
  activeFilters: ActiveFilter[];
  /** Currently active range filters */
  activeRangeFilters: ActiveRangeFilter[];
  /** Computed range filter bounds */
  rangeFilterBounds: Map<string, RangeFilterBounds>;
  basePath: string;
  currentSearchParams: URLSearchParams;
};

export default function CustomFiltersBar({
  filterDefinitions,
  customFilters,
  activeFilters,
  activeRangeFilters,
  rangeFilterBounds,
  basePath,
  currentSearchParams,
}: CustomFiltersBarProps) {
  const router = useRouter();
  const { startLoading } = useProductsLoading();
  const [, startTransition] = useTransition();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Track dropdown alignment (left or right) to prevent overflow
  const [dropdownAlign, setDropdownAlign] = useState<'left' | 'right'>('left');

  // Local state for range filters (updated on slider change, applied on blur/close)
  const [localRangeValues, setLocalRangeValues] = useState<
    Map<string, { min: number; max: number }>
  >(new Map());

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (!openDropdown) return;

    const menuEl = menuRefs.current.get(openDropdown);
    const triggerEl = dropdownRefs.current.get(openDropdown);

    if (!menuEl || !triggerEl) return;

    // Wait for next frame to ensure menu is rendered
    requestAnimationFrame(() => {
      const menuRect = menuEl.getBoundingClientRect();
      const triggerRect = triggerEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const padding = 16; // Minimum distance from viewport edge

      // Check if menu would overflow on the right
      const rightOverflow =
        triggerRect.left + menuRect.width > viewportWidth - padding;

      // Check if aligning to the right would work better
      const leftOverflow = triggerRect.right - menuRect.width < padding;

      if (rightOverflow && !leftOverflow) {
        setDropdownAlign('right');
      } else {
        setDropdownAlign('left');
      }
    });
  }, [openDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const allDropdowns = Array.from(dropdownRefs.current.values());
      const clickedInside = allDropdowns.some((dropdown) =>
        dropdown.contains(event.target as Node),
      );

      if (!clickedInside) {
        // Just close without applying - user must click "Filtruj" button
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown]);

  // If no filter definitions, don't render anything
  if (!filterDefinitions || filterDefinitions.length === 0) {
    return null;
  }

  // Helper to check if a filter definition has options (dropdown) or bounds (range)
  // Also returns true if the filter is currently active (so user can remove it)
  const hasFilterOptions = (def: CustomFilterDefinition): boolean => {
    if (def.filterType === 'dropdown') {
      const filter = customFilters.find((f) => f.name === def.name);
      const isActive = activeFilters.some((f) => f.filterName === def.name);
      return isActive || (!!filter && filter.values.length > 0);
    }
    if (def.filterType === 'range') {
      const bounds = rangeFilterBounds.get(def.name);
      const isActive = activeRangeFilters.some(
        (f) =>
          f.filterName === def.name &&
          (f.minValue !== undefined || f.maxValue !== undefined),
      );
      // Show if active OR if there's a valid range to select
      return (
        isActive ||
        (!!bounds && bounds.productCount > 0 && bounds.min < bounds.max)
      );
    }
    return false;
  };

  // Filter definitions that have options or are currently active
  const visibleFilterDefinitions = filterDefinitions.filter(hasFilterOptions);

  // ----------------------------------------
  // Dropdown Filter Handlers
  // ----------------------------------------

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
    startLoading('filter');
    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  const handleClearDropdownFilter = (
    filterName: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation(); // Prevent opening dropdown
    const params = new URLSearchParams(currentSearchParams);
    const slugifiedName = slugifyFilterName(filterName);
    params.delete(slugifiedName);
    params.delete('page');

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    setOpenDropdown(null);
    startLoading('filter');
    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  // ----------------------------------------
  // Range Filter Handlers
  // ----------------------------------------

  const getActiveRangeFilter = (
    filterName: string,
  ): ActiveRangeFilter | undefined => {
    return activeRangeFilters.find((f) => f.filterName === filterName);
  };

  const getRangeFilterValues = (
    filterName: string,
  ): { min: number; max: number } => {
    // First check local state
    const local = localRangeValues.get(filterName);
    if (local) return local;

    // Then check active URL values
    const active = getActiveRangeFilter(filterName);
    const bounds = rangeFilterBounds.get(filterName);

    return {
      min: active?.minValue ?? bounds?.min ?? 0,
      max: active?.maxValue ?? bounds?.max ?? 100,
    };
  };

  const handleRangeMinChange = (filterName: string, value: number) => {
    setLocalRangeValues((prev) => {
      const next = new Map(prev);
      const current = getRangeFilterValues(filterName);
      next.set(filterName, { ...current, min: value });
      return next;
    });
  };

  const handleRangeMaxChange = (filterName: string, value: number) => {
    setLocalRangeValues((prev) => {
      const next = new Map(prev);
      const current = getRangeFilterValues(filterName);
      next.set(filterName, { ...current, max: value });
      return next;
    });
  };

  const applyRangeFilter = (filterName: string) => {
    const local = localRangeValues.get(filterName);
    if (!local) return;

    const bounds = rangeFilterBounds.get(filterName);
    if (!bounds) return;

    const params = new URLSearchParams(currentSearchParams);
    const slugifiedName = slugifyFilterName(filterName);

    // Only include params that differ from bounds
    // URL format: {slug}-min and {slug}-max
    if (local.min > bounds.min) {
      params.set(`${slugifiedName}-min`, local.min.toString());
    } else {
      params.delete(`${slugifiedName}-min`);
    }

    if (local.max < bounds.max) {
      params.set(`${slugifiedName}-max`, local.max.toString());
    } else {
      params.delete(`${slugifiedName}-max`);
    }

    params.delete('page');

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    // Clear local state after applying
    setLocalRangeValues((prev) => {
      const next = new Map(prev);
      next.delete(filterName);
      return next;
    });

    startLoading('filter');
    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  const handleClearRangeFilter = (filterName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening dropdown
    const params = new URLSearchParams(currentSearchParams);
    const slugifiedName = slugifyFilterName(filterName);
    params.delete(`${slugifiedName}-min`);
    params.delete(`${slugifiedName}-max`);
    params.delete('page');

    // Clear local state
    setLocalRangeValues((prev) => {
      const next = new Map(prev);
      next.delete(filterName);
      return next;
    });

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    setOpenDropdown(null);
    startLoading('filter');
    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  // ----------------------------------------
  // Clear All Filters
  // ----------------------------------------

  const handleClearAll = () => {
    const params = new URLSearchParams(currentSearchParams);

    // Clear dropdown filters
    filterDefinitions
      .filter((f) => f.filterType === 'dropdown')
      .forEach((filter) => {
        const slugifiedName = slugifyFilterName(filter.name);
        params.delete(slugifiedName);
      });

    // Clear range filters
    filterDefinitions
      .filter((f) => f.filterType === 'range')
      .forEach((filter) => {
        const slugifiedName = slugifyFilterName(filter.name);
        params.delete(`${slugifiedName}-min`);
        params.delete(`${slugifiedName}-max`);
      });

    params.delete('page');

    // Clear local state
    setLocalRangeValues(new Map());

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    setOpenDropdown(null);
    startLoading('filter');
    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  // ----------------------------------------
  // Helper Functions
  // ----------------------------------------

  const getActiveDropdownValue = (filterName: string): string | null => {
    return (
      activeFilters.find((f) => f.filterName === filterName)?.value || null
    );
  };

  const isRangeFilterActive = (filterName: string): boolean => {
    const active = getActiveRangeFilter(filterName);
    return active?.minValue !== undefined || active?.maxValue !== undefined;
  };

  const getRangeFilterDisplayValue = (filterName: string): string | null => {
    const active = getActiveRangeFilter(filterName);
    const def = filterDefinitions.find((f) => f.name === filterName);

    // Show display value whenever there's any active selection
    if (!active) return null;
    if (active.minValue === undefined && active.maxValue === undefined)
      return null;

    const unit = def?.unit ? ` ${def.unit}` : '';

    // Build display based on what's set
    if (active.minValue !== undefined && active.maxValue !== undefined) {
      return `${active.minValue} - ${active.maxValue}${unit}`;
    }
    if (active.minValue !== undefined) {
      return `od ${active.minValue}${unit}`;
    }
    if (active.maxValue !== undefined) {
      return `do ${active.maxValue}${unit}`;
    }

    return null;
  };

  const hasAnyActiveFilters =
    activeFilters.length > 0 ||
    activeRangeFilters.some(
      (rf) => rf.minValue !== undefined || rf.maxValue !== undefined,
    );

  if (visibleFilterDefinitions.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Filtry</h3>

      {visibleFilterDefinitions.map((def) => {
        const isOpen = openDropdown === def.name;

        // ----------------------------------------
        // Dropdown Filter
        // ----------------------------------------
        if (def.filterType === 'dropdown') {
          const filter = customFilters.find((f) => f.name === def.name);
          if (!filter) return null;

          const activeValue = getActiveDropdownValue(def.name);

          return (
            <div
              key={def._key}
              className={styles.dropdown}
              ref={(el) => {
                if (el) dropdownRefs.current.set(def.name, el);
              }}
            >
              <button
                type="button"
                className={`${styles.trigger} ${activeValue ? styles.active : ''}`}
                onClick={() => setOpenDropdown(isOpen ? null : def.name)}
                aria-expanded={isOpen}
              >
                <span className={styles.filterName}>{def.name}</span>
                {activeValue && (
                  <span
                    className={styles.activeValue}
                    onClick={(e) => handleClearDropdownFilter(def.name, e)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClearDropdownFilter(
                          def.name,
                          e as unknown as React.MouseEvent<HTMLButtonElement>,
                        );
                      }
                    }}
                    aria-label={`Usuń filtr: ${activeValue}`}
                  >
                    {activeValue}
                    <CloseIcon />
                  </span>
                )}
                <ChevronIcon isOpen={isOpen} />
              </button>

              {isOpen && (
                <div
                  className={`${styles.menu} ${dropdownAlign === 'right' ? styles.alignRight : ''}`}
                  ref={(el) => {
                    if (el) menuRefs.current.set(def.name, el);
                  }}
                >
                  {filter.values.map((value) => {
                    const isActive = activeValue === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`${styles.item} ${isActive ? styles.selected : ''}`}
                        onClick={() => handleFilterSelect(def.name, value)}
                      >
                        <span>{value}</span>
                        {isActive && <CheckIcon />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        // ----------------------------------------
        // Range Filter
        // ----------------------------------------
        if (def.filterType === 'range') {
          const bounds = rangeFilterBounds.get(def.name);
          const rangeActive = isRangeFilterActive(def.name);
          const displayValue = getRangeFilterDisplayValue(def.name);
          const currentValues = getRangeFilterValues(def.name);

          // Check if there's a valid range to adjust (min < max)
          const hasValidRange = bounds && bounds.min < bounds.max;

          // If no bounds and not active, don't show
          if (!bounds && !rangeActive) return null;

          // If active but no valid range - show non-openable button with remove only
          if (rangeActive && !hasValidRange) {
            return (
              <div key={def._key} className={styles.dropdown}>
                <div
                  className={`${styles.trigger} ${styles.active} ${styles.disabled}`}
                >
                  <span className={styles.filterName}>
                    {def.name}
                    {def.unit && (
                      <span className={styles.filterUnit}> ({def.unit})</span>
                    )}
                  </span>
                  {displayValue && (
                    <span
                      className={styles.activeValue}
                      onClick={(e) => handleClearRangeFilter(def.name, e)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleClearRangeFilter(
                            def.name,
                            e as unknown as React.MouseEvent<HTMLButtonElement>,
                          );
                        }
                      }}
                      aria-label={`Usuń filtr: ${displayValue}`}
                    >
                      {displayValue}
                      <CloseIcon />
                    </span>
                  )}
                </div>
              </div>
            );
          }

          // Normal openable range filter
          if (!bounds) return null;

          return (
            <div
              key={def._key}
              className={styles.dropdown}
              ref={(el) => {
                if (el) dropdownRefs.current.set(def.name, el);
              }}
            >
              <button
                type="button"
                className={`${styles.trigger} ${rangeActive ? styles.active : ''}`}
                onClick={() => setOpenDropdown(isOpen ? null : def.name)}
                aria-expanded={isOpen}
              >
                <span className={styles.filterName}>
                  {def.name}
                  {def.unit && (
                    <span className={styles.filterUnit}> ({def.unit})</span>
                  )}
                </span>
                {displayValue && (
                  <span
                    className={styles.activeValue}
                    onClick={(e) => handleClearRangeFilter(def.name, e)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClearRangeFilter(
                          def.name,
                          e as unknown as React.MouseEvent<HTMLButtonElement>,
                        );
                      }
                    }}
                    aria-label={`Usuń filtr: ${displayValue}`}
                  >
                    {displayValue}
                    <CloseIcon />
                  </span>
                )}
                <ChevronIcon isOpen={isOpen} />
              </button>

              {isOpen && (
                <div
                  className={`${styles.rangeMenu} ${dropdownAlign === 'right' ? styles.alignRight : ''}`}
                  ref={(el) => {
                    if (el) menuRefs.current.set(def.name, el);
                  }}
                >
                  <RangeFilter
                    name={def.name}
                    unit={def.unit}
                    minValue={currentValues.min}
                    maxValue={currentValues.max}
                    minLimit={bounds.min}
                    maxLimit={bounds.max}
                    onMinChange={(value) =>
                      handleRangeMinChange(def.name, value)
                    }
                    onMaxChange={(value) =>
                      handleRangeMaxChange(def.name, value)
                    }
                  />
                  <button
                    type="button"
                    className={styles.rangeSubmit}
                    onClick={() => {
                      applyRangeFilter(def.name);
                      setOpenDropdown(null);
                    }}
                  >
                    Filtruj
                  </button>
                </div>
              )}
            </div>
          );
        }

        return null;
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

// ----------------------------------------
// Icons
// ----------------------------------------

const CloseIcon = () => (
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
);

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
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
);

const CheckIcon = () => (
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
);
