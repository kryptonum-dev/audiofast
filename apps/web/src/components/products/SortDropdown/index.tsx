'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import styles from './styles.module.scss';

type SortOption = {
  value: string;
  label: string;
};

type SortDropdownProps = {
  options: SortOption[];
  basePath: string;
  defaultValue?: string;
  label?: string;
  hasSearchQuery?: boolean;
};

export default function SortDropdown({
  options,
  basePath,
  defaultValue = 'newest',
  label = 'Sortuj:',
  hasSearchQuery = false,
}: SortDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter out 'orderRank' (relevance) option if there's no search query
  const availableOptions = hasSearchQuery
    ? options
    : options.filter((opt) => opt.value !== 'orderRank');

  // Determine current value based on search query presence
  const currentValue = searchParams.get('sortBy') || defaultValue;
  const currentLabel =
    availableOptions.find((opt) => opt.value === currentValue)?.label ||
    availableOptions[0]?.label ||
    'Sortuj';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown when focus leaves the dropdown container
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusOut = (event: FocusEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.relatedTarget as Node)
      ) {
        setIsOpen(false);
      }
    };

    const dropdownElement = dropdownRef.current;
    dropdownElement?.addEventListener('focusout', handleFocusOut);

    return () => {
      dropdownElement?.removeEventListener('focusout', handleFocusOut);
    };
  }, [isOpen]);

  const handleOptionClick = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === defaultValue) {
      params.delete('sortBy');
    } else {
      params.set('sortBy', value);
    }

    // Reset to page 1 when sorting changes
    params.delete('page');

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    startTransition(() => {
      router.push(newUrl);
    });
    setIsOpen(false);
  };

  return (
    <div className={styles.sortDropdown} ref={dropdownRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className={styles.labelSection}>
          <FilterIcon />
          <span className={styles.label}>{label}</span>
        </div>
        <div className={styles.valueSection}>
          <span className={styles.value}>{currentLabel}</span>
          <SortIcon />
        </div>
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          {availableOptions.map((option) => {
            const isActive = currentValue === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`${styles.option} ${isActive ? styles.active : ''}`}
                onClick={() => handleOptionClick(option.value)}
                tabIndex={isActive ? -1 : 0}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none">
    <path
      stroke="#FE0140"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
      d="M3.6 1.4h8.8c.733 0 1.333.6 1.333 1.333V4.2c0 .533-.333 1.2-.666 1.533L10.2 8.267c-.4.333-.667 1-.667 1.533v2.867c0 .4-.266.933-.6 1.133L8 14.4c-.867.533-2.067-.067-2.067-1.133V9.733c0-.466-.266-1.066-.533-1.4L2.867 5.667c-.334-.334-.6-.934-.6-1.334V2.8c0-.8.6-1.4 1.333-1.4ZM7.287 1.4 4 6.667"
    />
  </svg>
);

const SortIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none">
    <path
      stroke="#FE0140"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M2 4.667h12M4 8h8M6.667 11.333h2.666"
    />
  </svg>
);
